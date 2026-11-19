import { STATUS_BY_ID } from '../../lib/useLiveTrains.js';

const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : null);

/** Gráfico pequeño con cómo ha ido cambiando el retraso del tren durante el viaje. */
function DelaySparkline({ points }) {
  if (!points || points.length < 2) return null;
  const W = 280;
  const H = 56;
  const t0 = points[0].t;
  const t1 = points.at(-1).t;
  const max = Math.max(5, ...points.map((p) => p.delay));
  const min = Math.min(0, ...points.map((p) => p.delay));
  const x = (t) => ((t - t0) / (t1 - t0 || 1)) * W;
  const y = (d) => H - ((d - min) / (max - min || 1)) * (H - 8) - 4;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.delay).toFixed(1)}`).join(' ');
  const last = points.at(-1);
  return (
    <figure className="sparkline">
      <figcaption>
        Evolución del retraso <span>(máx. {max} min)</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`El retraso ha pasado de ${points[0].delay} a ${last.delay} minutos`}>
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} className="sparkline-zero" />
        <path d={`${line} L${W},${H} L0,${H} Z`} className="sparkline-area" />
        <path d={line} className="sparkline-line" />
        <circle cx={x(last.t)} cy={y(last.delay)} r="3.5" className="sparkline-dot" />
      </svg>
      <div className="sparkline-axis">
        <span>{hhmm(new Date(t0).toISOString())}</span>
        <span>{hhmm(new Date(t1).toISOString())}</span>
      </div>
    </figure>
  );
}

/** Ficha de seguimiento de un tren en tiempo real. */
export default function TrainDetail({ train, detail, loading, follow, onToggleFollow, onClose }) {
  const t = detail?.train ?? train;
  if (!t) {
    return (
      <div className="train-detail">
        <button type="button" className="back" onClick={onClose}>
          ← Todos los trenes
        </button>
        <p className="empty">Este tren ya no aparece en circulación.</p>
      </div>
    );
  }

  const delay = t.officialDelayMin;
  const now = Date.now();
  const stops = detail?.stops ?? [];
  // Una parada ya se ha pasado si su hora prevista + retraso es anterior a ahora.
  const passed = (s) => {
    const when = s.departure ?? s.arrival;
    return when ? Date.parse(when) + (delay ?? 0) * 60_000 < now : false;
  };

  return (
    <div className="train-detail">
      <button type="button" className="back" onClick={onClose}>
        ← Todos los trenes
      </button>

      <div className="details-head">
        <span className="details-bar" style={{ background: t.color ?? 'var(--accent)' }} />
        <div>
          <p className="eyebrow">{t.type}</p>
          <h2>{t.label}</h2>
          {t.origin && t.destination && (
            <p className="train-detail-route">
              {t.origin} → {t.destination}
            </p>
          )}
        </div>
      </div>

      <div className="train-detail-status">
        <span className={`status-pill status-pill--${t.status}`}>{STATUS_BY_ID[t.status].label}</span>
        {delay != null && (
          <span className={`official-tag${delay >= 5 ? ' is-late' : delay <= 0 ? ' is-ok' : ''}`}>
            {delay > 0 ? `+${delay} min` : delay < 0 ? `${delay} min (adelantado)` : 'Puntual'}
          </span>
        )}
        {t.stale && <span className="official-tag">Posición sin actualizar</span>}
      </div>

      <dl className="facts">
        <div>
          <dt>{t.status === 'stopped' ? 'Estación' : 'Próxima parada'}</dt>
          <dd>{t.stopName ?? '—'}</dd>
        </div>
        <div>
          <dt>Llegada prevista</dt>
          <dd>
            {hhmm(t.nextArrival) ?? '—'}
            {t.platform && <small> · vía {t.platform}</small>}
          </dd>
        </div>
        {t.speedKmh != null && (
          <div>
            <dt>Velocidad</dt>
            <dd>{t.speedKmh} km/h</dd>
          </div>
        )}
        {t.status === 'delay' && (
          <div>
            <dt>Sin moverse</dt>
            <dd>{t.stillMinutes} min</dd>
          </div>
        )}
      </dl>

      <button type="button" className={`btn btn-small follow-btn${follow ? ' is-on' : ''}`} aria-pressed={follow} onClick={onToggleFollow}>
        {follow ? 'Dejar de seguir' : 'Seguir el tren en el mapa'}
      </button>

      <DelaySparkline points={detail?.delayHistory?.points} />

      <h3 className="group-title">Recorrido</h3>
      {loading && !stops.length && <p className="empty">Cargando paradas…</p>}
      {!loading && !stops.length && <p className="empty">No hay información de paradas para este tren.</p>}
      {stops.length > 0 && (
        <ol className="stops live-stops" style={{ '--line': t.color ?? 'var(--accent)' }}>
          {stops.map((s, i) => (
            <li key={`${s.code}-${i}`} className={passed(s) ? 'is-passed' : ''}>
              <span>{s.name}</span>
              <time>{hhmm(s.departure ?? s.arrival) ?? s.scheduled ?? ''}</time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
