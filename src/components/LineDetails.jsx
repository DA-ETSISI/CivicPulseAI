/** Ficha de una línea: tipo de tren, servicios programados y paradas. */
export default function LineDetails({ line, onClose }) {
  return (
    <aside className="panel details" aria-label={`Detalle de ${line.name}`}>
      <button type="button" className="back" onClick={onClose}>
        ← Todas las líneas
      </button>

      <div className="details-head">
        <span className="details-bar" style={{ background: line.color }} />
        <div>
          <p className="eyebrow">Alta velocidad</p>
          <h2>{line.name}</h2>
        </div>
      </div>

      <dl className="facts">
        <div>
          <dt>Tipo de tren</dt>
          <dd>{line.types.join(', ')}</dd>
        </div>
        <div>
          <dt>Servicios programados</dt>
          <dd>{line.trips.toLocaleString('es-ES')}</dd>
        </div>
        <div>
          <dt>Paradas</dt>
          <dd>{line.stops.length}</dd>
        </div>
        <div>
          <dt>Trazado</dt>
          <dd>{line.realTrack ? 'Vía real' : 'Aproximado'}</dd>
        </div>
      </dl>

      <h3 className="group-title">Paradas del recorrido más completo</h3>
      <ol className="stops" style={{ '--line': line.color }}>
        {line.stops.map((s, i) => (
          <li key={`${s}-${i}`}>{s}</li>
        ))}
      </ol>
    </aside>
  );
}
