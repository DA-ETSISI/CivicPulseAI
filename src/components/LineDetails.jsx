import { IconArrowLeft } from './icons.jsx';

/** Ficha de una ruta de alta velocidad: servicios, frecuencia, comunidades y paradas. */
export default function LineDetails({ line, highlightedStop = null, onStopPick, onClose }) {
  return (
    <div className="details" aria-label={`Detalle de ${line.name}`}>
      <button type="button" className="back" onClick={onClose}>
        <IconArrowLeft size={16} />
        Todas las rutas
      </button>

      <div className="details-head">
        <span className="route-dot route-dot--lg" style={{ background: line.color }} aria-hidden="true" />
        <h2>{line.name}</h2>
      </div>

      <dl className="facts">
        <div>
          <dt>Servicios</dt>
          <dd>{line.types.join(', ').replace('AVE Euromed', 'Euromed')}</dd>
        </div>
        <div>
          <dt>Trenes programados</dt>
          <dd className="num">{line.trips.toLocaleString('es-ES')}</dd>
        </div>
        <div>
          <dt>Paradas</dt>
          <dd className="num">{line.stops.length}</dd>
        </div>
        <div>
          <dt>Trazado</dt>
          <dd>{line.realTrack ? 'Vía real' : 'Aproximado'}</dd>
        </div>
      </dl>

      {line.regions?.length > 0 && <p className="details-regions">{line.regions.map((r) => r.name).join(' · ')}</p>}

      <h3 className="group-title">Paradas del recorrido más completo</h3>
      <ol className={`stops stops--pickable${highlightedStop != null ? ' has-highlight' : ''}`} style={{ '--line': line.color }}>
        {line.stops.map((s, i) => (
          <li key={`${s}-${i}`} className={i === highlightedStop ? 'is-highlighted' : ''}>
            <button type="button" className="stop-button" aria-pressed={i === highlightedStop} onClick={() => onStopPick?.(line.id, i)}>
              {s}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
