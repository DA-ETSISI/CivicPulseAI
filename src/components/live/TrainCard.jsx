import { NETWORK_BY_ID, SERVICE_BY_ID } from '../../lib/trainFilters.js';
import { STATUS_BY_ID } from '../../lib/useLiveTrains.js';
import { BookButton } from './LineCard.jsx';

/** Ficha del tren seleccionado en el mapa. `onBook` (opcional) muestra el botón de comprar billete. */
export default function TrainCard({ train, onClose, onBook }) {
  const status = STATUS_BY_ID[train.status];
  const network = NETWORK_BY_ID[train.network];

  return (
    <div className="train-card" role="dialog" aria-label={`Detalles de ${train.label}`}>
      <div className="train-card-head">
        <span className={`svc-dot svc-dot--${train.service}`} />
        <div>
          <p className="train-card-title">{train.label}</p>
          <p className="train-card-sub">
            {SERVICE_BY_ID[train.service]?.label}
            {network && ` · Cercanías ${network.label}`}
          </p>
        </div>
        <button type="button" className="train-card-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>
      <dl className="train-card-list">
        {train.origin && (
          <>
            <dt>Recorrido</dt>
            <dd>
              {train.origin} → {train.destination}
            </dd>
          </>
        )}
        {status && (
          <>
            <dt>Estado</dt>
            <dd>
              <span className={`status-dot status-dot--${train.status}`} />
              {status.label}
              {train.stopName && ` · ${train.status === 'stopped' ? 'en' : 'hacia'} ${train.stopName}`}
            </dd>
          </>
        )}
        {train.provinceName && (
          <>
            <dt>Provincia</dt>
            <dd>{train.provinceName}</dd>
          </>
        )}
        {train.officialDelayMin != null && (
          <>
            <dt>Puntualidad</dt>
            <dd className={train.officialDelayMin >= 5 ? 'is-late' : undefined}>
              {train.officialDelayMin > 0 ? `${train.officialDelayMin} min de retraso` : 'En hora'}
            </dd>
          </>
        )}
      </dl>
      {onBook && <BookButton onClick={onBook} />}
    </div>
  );
}
