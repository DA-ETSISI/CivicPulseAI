import { useMemo, useState } from 'react';
import LineDetails from './LineDetails.jsx';
import { IconChevron, IconSearch } from './icons.jsx';
import { groupByRegion, matchesQuery, splitMatch } from '../lib/regions.js';
import { splitByService } from '../lib/serviceStatus.js';

const SERVICE_LABEL = { AVE: 'AVE', AVLO: 'AVLO', 'AVE Euromed': 'Euromed' };

/** Texto con la parte que coincide con la búsqueda resaltada. */
function Highlight({ text, query }) {
  const parts = splitMatch(text, query) ?? [{ text, match: false }];
  return parts.map((p, i) => (p.match ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>));
}

/**
 * Panel lateral de Rutas: buscador y acordeón con una pestaña por comunidad autónoma.
 * Al escribir se abren solo las comunidades con resultados; si hay una ruta elegida, se ve su ficha.
 */
export default function LinePanel({ lines, selected, hoveredId, highlightedStop, onHover, onSelect, onStopPick }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(() => new Set());

  const groups = useMemo(() => {
    const visible = lines.filter((l) => matchesQuery(l, query));
    return groupByRegion(visible);
  }, [lines, query]);

  const searching = query.trim().length > 0;
  const isOpen = (name) => (searching ? true : open.has(name));
  const toggle = (name) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  if (selected) {
    return <LineDetails line={selected} highlightedStop={highlightedStop} onStopPick={onStopPick} onClose={() => onSelect(null)} />;
  }

  return (
    <div className="route-panel">
      <label className="search">
        <span className="visually-hidden">Buscar una ciudad, estación o ruta</span>
        <IconSearch size={16} />
        <input type="search" placeholder="Busca una ciudad o estación" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      <div className="panel-scroll">
        {groups.length === 0 && (
          <div className="empty-state">
            <p className="empty-title">Ningún tren pasa por aquí… todavía.</p>
            <p>
              No hay rutas de alta velocidad que coincidan con «{query.trim()}». Prueba con otra ciudad o activa más servicios.
            </p>
          </div>
        )}

        <ul className="regions">
          {groups.map((g) => {
            const expanded = isOpen(g.name);
            const panelId = `region-${g.name.replace(/\W+/g, '-')}`;
            return (
              <li key={g.name} className={`region${expanded ? ' is-open' : ''}`}>
                <h3>
                  <button type="button" className="region-head" aria-expanded={expanded} aria-controls={panelId} onClick={() => toggle(g.name)}>
                    <IconChevron size={16} className="region-chevron" />
                    <span className="region-name">{g.name}</span>
                    <span className="region-count">{g.items.length}</span>
                  </button>
                </h3>
                {/* Plegada: `inert` impide que las filas ocultas reciban el ratón o el foco, también mientras se cierra. */}
                <div className="region-body" id={panelId} role="region" aria-label={g.name} inert={!expanded}>
                  <ul className="region-lines">
                    {/* Primero las rutas en servicio ahora; después, bajo un separador, las que no. */}
                    {(() => {
                      const { active, inactive } = splitByService(g.items, (it) => it.line.status ?? {});
                      return [...active, ...(inactive.length ? [{ divider: true }] : []), ...inactive];
                    })().map((item) =>
                      item.divider ? (
                        <li key="divider" className="service-divider" role="presentation">
                          Sin servicio ahora
                        </li>
                      ) : (
                        <RouteItem key={item.line.id} item={item} query={query} hoveredId={hoveredId} onHover={onHover} onSelect={onSelect} />
                      ),
                    )}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Fila de una ruta: color, nombre (con la búsqueda resaltada), servicios y estado a esta hora. */
function RouteItem({ item: { line, stopsHere, isEnd }, query, hoveredId, onHover, onSelect }) {
  const inactive = line.status?.state === 'inactive';
  return (
    <li>
      <button
        type="button"
        className={`route-item${hoveredId === line.id ? ' is-hover' : ''}${inactive ? ' is-inactive' : ''}`}
        onPointerEnter={() => onHover(line.id)}
        onPointerLeave={() => onHover(null)}
        onFocus={() => onHover(line.id)}
        onBlur={() => onHover(null)}
        onClick={() => onSelect(line.id)}
      >
        <span className="route-dot" style={{ background: line.color }} aria-hidden="true" />
        <span className="route-text">
          <span className="route-name">
            <Highlight text={line.name} query={query} />
          </span>
          {!isEnd && <span className="route-via">Para en {stopsHere.join(', ')}</span>}
          {inactive && <span className="route-via route-status">{line.status.label}</span>}
        </span>
        <span className="route-tags">
          {line.types.map((t) => (
            <span key={t} className={`service-tag service-tag--${t.split(' ').pop().toLowerCase()}`}>
              {SERVICE_LABEL[t] ?? t}
            </span>
          ))}
        </span>
      </button>
    </li>
  );
}
