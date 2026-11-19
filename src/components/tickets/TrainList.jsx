import { useState } from 'react';
import { addDays, fmtDate, fmtDuration, fmtPrice, fmtTime, todayIso } from '../../lib/timetable.js';
import { useTrainInsights } from '../../lib/useTrainInsights.js';

/** Estado en directo (si circula hoy) y puntualidad de los últimos 30 días. */
function TrainInsight({ live, stats }) {
  if (!live && !stats) return null;
  return (
    <span className="train-insight">
      {live && (
        <span className={`insight-live${live.officialDelayMin >= 5 ? ' is-late' : ''}`}>
          <span className="live-pulse" aria-hidden="true" />
          {live.officialDelayMin > 0 ? `Circulando · +${live.officialDelayMin} min` : 'Circulando · puntual'}
        </span>
      )}
      {stats?.onTimePercent != null && (
        <span title={`Últimos ${stats.window ?? '30d'} · ${stats.trips} viajes · retraso medio ${stats.avgDelay} min`}>
          Puntualidad {stats.onTimePercent} %
        </span>
      )}
    </span>
  );
}

/** Listado de trenes de un día, con selector de día y tarifas desplegables. */
export default function TrainList({ title, date, minDate, maxDate, results, selectedId, onChangeDate, onSelect }) {
  const [openId, setOpenId] = useState(null);
  const insights = useTrainInsights(results.map((r) => r.number));
  const isToday = date === todayIso();

  return (
    <div className="train-list">
      <div className="train-list-head">
        <h3>{title}</h3>
        <div className="day-switch">
          <button type="button" disabled={date <= minDate} onClick={() => onChangeDate(addDays(date, -1))} aria-label="Día anterior">
            ‹
          </button>
          <span>{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <button type="button" disabled={date >= maxDate} onClick={() => onChangeDate(addDays(date, 1))} aria-label="Día siguiente">
            ›
          </button>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="no-trains">
          <strong>No hay trenes directos para este día.</strong>
          <span>Prueba con otra fecha o con otra estación de la misma ciudad.</span>
        </div>
      ) : (
        <ul className="trains">
          {results.map((r) => {
            const open = openId === r.id;
            const from = Math.min(...r.fares.map((f) => f.price));
            return (
              <li key={r.id} className={`train${open ? ' is-open' : ''}${selectedId === r.id ? ' is-selected' : ''}`}>
                <button type="button" className="train-main" aria-expanded={open} onClick={() => setOpenId(open ? null : r.id)}>
                  <span className="train-times">
                    <span className="time">{fmtTime(r.dep)}</span>
                    <span className="train-track">
                      <span>{fmtDuration(r.duration)}</span>
                    </span>
                    <span className="time">
                      {fmtTime(r.arr)}
                      {r.arr >= 1440 && <sup>+1</sup>}
                    </span>
                  </span>
                  <span className="train-stations">
                    <span>{r.from}</span>
                    <span>{r.to}</span>
                  </span>
                  <span className="train-meta">
                    <span className={`badge badge--${r.type.split(' ')[0].toLowerCase()}`}>{r.type}</span>
                    <span>Nº {r.number}</span>
                    <span>{r.stopsBetween === 0 ? 'Directo' : `${r.stopsBetween} parada${r.stopsBetween > 1 ? 's' : ''}`}</span>
                    <TrainInsight live={isToday ? insights.live[r.number] : null} stats={insights.stats[r.number]} />
                  </span>
                  <span className="train-price">
                    <small>desde</small>
                    {fmtPrice(from)}
                  </span>
                </button>

                {open && (
                  <div className="fares">
                    {r.fares.map((f) => (
                      <div key={f.id} className="fare">
                        <div className="fare-head">
                          <strong>{f.label}</strong>
                          <span className="fare-price">{fmtPrice(f.price)}</span>
                        </div>
                        <ul>
                          {f.perks.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                        <button type="button" className="btn btn-small" onClick={() => onSelect(r, f)}>
                          Seleccionar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
