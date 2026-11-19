import { useEffect, useRef } from 'react';
import { STATUS_BY_ID } from '../../lib/useLiveTrains.js';

const MAX_ROWS = 150;

/** Etiqueta con el retraso oficial que publica Renfe para ese tren. */
function OfficialDelay({ minutes }) {
  if (minutes == null) return null;
  if (minutes <= 0) return <span className="official-tag is-ok">Renfe: puntual</span>;
  return <span className={`official-tag${minutes >= 5 ? ' is-late' : ''}`}>Renfe: +{minutes} min</span>;
}

const hhmm = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

function where(t) {
  if (!t.stopName) return null;
  if (t.status === 'stopped') return `En ${t.stopName}`;
  const eta = t.nextArrival ? ` · llega ${hhmm(t.nextArrival)}` : '';
  if (t.status === 'incoming') return `Llegando a ${t.stopName}${eta}`;
  return `Hacia ${t.stopName}${eta}`;
}

/** Listado de trenes con su estado; los retrasos aparecen primero. */
export default function TrainStatusList({ trains, selectedId, onSelect }) {
  const listRef = useRef(null);

  // Al elegir un tren en el mapa, desplazar el listado hasta él.
  useEffect(() => {
    if (!selectedId) return;
    listRef.current?.querySelector(`[data-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  if (!trains.length) return <p className="empty">No hay trenes que coincidan con los filtros.</p>;

  return (
    <ul className="live-list" ref={listRef}>
      {trains.slice(0, MAX_ROWS).map((t) => (
        <li key={t.id} data-id={t.id}>
          <button
            type="button"
            className={`live-row${t.id === selectedId ? ' is-selected' : ''}`}
            onClick={() => onSelect(t.id === selectedId ? null : t.id)}
          >
            <span className={`status-pill status-pill--${t.status}`}>{STATUS_BY_ID[t.status].label}</span>
            <span className="live-main">
              <span className="live-title">
                <strong>{t.label}</strong>
                <OfficialDelay minutes={t.officialDelayMin} />
              </span>
              {t.origin && t.destination && (
                <span className="live-route">
                  {t.origin} → {t.destination}
                </span>
              )}
              <span className="live-where">
                {where(t)}
                {t.status === 'delay' && ` · sin moverse desde hace ${t.stillMinutes} min`}
              </span>
            </span>
          </button>
        </li>
      ))}
      {trains.length > MAX_ROWS && (
        <li className="empty">Y {trains.length - MAX_ROWS} trenes más. Usa los filtros o el buscador para acotar.</li>
      )}
    </ul>
  );
}
