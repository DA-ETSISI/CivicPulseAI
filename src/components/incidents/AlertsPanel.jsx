import { useMemo, useState } from 'react';

const PAGE = 8;
const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const fmt = (iso) =>
  new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Avisos oficiales de Renfe (obras, reajustes de servicio, ascensores fuera de servicio…). */
export default function AlertsPanel({ alerts, query }) {
  const [limit, setLimit] = useState(PAGE);

  const shown = useMemo(() => {
    const q = normalize(query.trim());
    return q
      ? alerts.filter((a) => normalize(`${a.text} ${a.lines.join(' ')} ${a.stops.join(' ')} ${a.networks.join(' ')}`).includes(q))
      : alerts;
  }, [alerts, query]);

  return (
    <div className="card alerts">
      <div className="alerts-head">
        <h2>Avisos de la red</h2>
        <span className="chip-count">{shown.length}</span>
      </div>
      {shown.length === 0 ? (
        <p className="empty">No hay avisos activos{query.trim() ? ` que coincidan con «${query}»` : ''}.</p>
      ) : (
        <ul className="alert-list">
          {shown.slice(0, limit).map((a) => (
            <li key={a.id} className="alert">
              <div className="alert-tags">
                <span className={`alert-kind alert-kind--${a.kind}`}>{a.kindLabel}</span>
                {a.networks.slice(0, 2).map((n) => (
                  <span key={n} className="alert-network">
                    {n}
                  </span>
                ))}
                {a.lines.slice(0, 6).map((l) => (
                  <span key={l} className="badge">
                    {l}
                  </span>
                ))}
                {a.start && <span className="alert-date">Desde {fmt(a.start)}</span>}
              </div>
              <p>{a.text}</p>
              {a.stops.length > 0 && <p className="alert-stops">Estaciones: {a.stops.slice(0, 5).join(', ')}</p>}
            </li>
          ))}
        </ul>
      )}
      {shown.length > limit && (
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setLimit((n) => n + PAGE)}>
          Ver más avisos
        </button>
      )}
    </div>
  );
}
