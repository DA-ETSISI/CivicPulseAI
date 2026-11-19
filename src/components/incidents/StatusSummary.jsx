import { STATUSES } from '../../lib/useLiveTrains.js';

/** Tarjetas con el número de trenes en cada estado; al pulsarlas filtran el listado. */
export default function StatusSummary({ counts, active, onToggle }) {
  return (
    <div className="status-cards" role="group" aria-label="Filtrar por estado">
      {STATUSES.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`status-card status-card--${s.id}${active.has(s.id) ? ' is-on' : ''}`}
          aria-pressed={active.has(s.id)}
          title={s.hint}
          onClick={() => onToggle(s.id)}
        >
          <span className="status-card-label">
            <span className={`status-dot status-dot--${s.id}`} aria-hidden="true" />
            {s.label}
          </span>
          <strong>{counts[s.id] ?? 0}</strong>
          <small>{s.hint}</small>
        </button>
      ))}
    </div>
  );
}
