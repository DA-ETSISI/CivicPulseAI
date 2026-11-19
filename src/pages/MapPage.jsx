import { useCallback, useMemo, useState } from 'react';
import RailMap from '../components/RailMap.jsx';
import CategoryFilter from '../components/CategoryFilter.jsx';
import LinePanel from '../components/LinePanel.jsx';
import { useNetworkData } from '../lib/useNetworkData.js';
import { CATEGORIES } from '../lib/categories.js';
import { lineColor } from '../lib/colors.js';

/** Sección «Mapa»: red de alta velocidad con filtros por tipo de tren y listado de líneas. */
export default function MapPage({ theme, id = 'mapa' }) {
  const data = useNetworkData();
  const [visible, setVisible] = useState(() => new Set(CATEGORIES.map((c) => c.id)));
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  // Cada línea tiene su color; en modo oscuro se aclara.
  const lines = useMemo(
    () => (data.lines ?? []).map((line, i) => ({ ...line, color: lineColor(i, theme) })),
    [data.lines, theme],
  );
  const shown = useMemo(() => lines.filter((l) => l.types.some((t) => visible.has(t))), [lines, visible]);
  const counts = useMemo(() => {
    const c = {};
    for (const l of lines) for (const t of l.types) c[t] = (c[t] ?? 0) + 1;
    return c;
  }, [lines]);
  const selected = shown.find((l) => l.id === selectedId) ?? null;

  const toggle = (id) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else next.add(id);
      return next;
    });

  // Pulsar de nuevo la misma línea la deselecciona.
  const select = useCallback((id) => setSelectedId((cur) => (id && cur === id ? null : id)), []);

  return (
    <section className="page" id={id}>
      <div className="page-head">
        <h1>La alta velocidad en España, de un vistazo</h1>
        <p>
          Pasa el ratón por encima de una línea para resaltarla o púlsala para ver sus paradas. Acércate con la rueda
          del ratón o pellizcando la pantalla.
        </p>
      </div>

      <div className="card map-card">
        <div className="map-toolbar">
          <CategoryFilter visible={visible} counts={counts} onToggle={toggle} />
        </div>

        <div className="map-layout">
          <div className="map-area">
            {data.status === 'loading' && <div className="map-status">Cargando la red ferroviaria…</div>}
            {data.status === 'error' && (
              <div className="map-status">No se han podido cargar los datos. Ejecuta «npm run data» y recarga.</div>
            )}
            {data.status === 'ready' && (
              <RailMap
                provinces={data.provinces}
                countries={data.countries}
                lines={shown}
                hoveredId={hoveredId}
                selectedId={selected?.id ?? null}
                onHover={setHoveredId}
                onSelect={select}
              />
            )}
          </div>

          {data.status === 'ready' && (
            <LinePanel
              lines={shown}
              selected={selected}
              hoveredId={hoveredId}
              onHover={setHoveredId}
              onSelect={select}
            />
          )}
        </div>
      </div>

      {data.status === 'ready' && (
        <footer className="sources">
          Datos abiertos oficiales:{' '}
          {data.meta.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ' · '}
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.name}
              </a>
            </span>
          ))}
          . Actualizado el {new Date(data.meta.generatedAt).toLocaleDateString('es-ES')}.
        </footer>
      )}
    </section>
  );
}
