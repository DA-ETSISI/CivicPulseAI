import { useMemo, useState } from 'react';
import LineDetails from './LineDetails.jsx';

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Panel lateral: buscador + listado de líneas, o el detalle de la seleccionada. */
export default function LinePanel({ lines, selected, hoveredId, onHover, onSelect }) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    return q ? lines.filter((l) => normalize(`${l.name} ${l.stops.join(' ')} ${l.types.join(' ')}`).includes(q)) : lines;
  }, [lines, query]);

  if (selected) return <LineDetails line={selected} onClose={() => onSelect(null)} />;

  return (
    <aside className="panel" aria-label="Listado de líneas">
      <label className="search">
        <span className="visually-hidden">Buscar ciudad o línea</span>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          placeholder="Busca una ciudad o estación"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="panel-scroll">
        {matches.length === 0 && <p className="empty">No hay líneas que coincidan con «{query}».</p>}
        {matches.length > 0 && (
          <section className="group">
            <h3 className="group-title">
              Líneas de alta velocidad <span>{matches.length}</span>
            </h3>
            <ul>
              {matches.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className={`line-item${hoveredId === l.id ? ' is-hover' : ''}`}
                    onPointerEnter={() => onHover(l.id)}
                    onPointerLeave={() => onHover(null)}
                    onFocus={() => onHover(l.id)}
                    onBlur={() => onHover(null)}
                    onClick={() => onSelect(l.id)}
                  >
                    <span className="swatch" style={{ background: l.color }} />
                    <span className="line-name">{l.name}</span>
                    <span className="line-type">{l.types.join(' · ').replace('AVE Euromed', 'Euromed')}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}
