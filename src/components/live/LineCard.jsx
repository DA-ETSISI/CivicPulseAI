/** Ficha de la línea seleccionada en el mapa, con acceso directo a la compra de billetes. */
export default function LineCard({ line, onClose, onBook }) {
  const from = line.stops[0];
  const to = line.stops.at(-1);
  const middle = line.stops.slice(1, -1);

  return (
    <div className="train-card" role="dialog" aria-label={`Línea ${line.name}`}>
      <div className="train-card-head">
        <span className="line-swatch" aria-hidden="true" />
        <div>
          <p className="train-card-title">{line.name}</p>
          <p className="train-card-sub">
            {line.types?.join(' · ')}
            {line.trips ? ` · ${line.trips.toLocaleString('es-ES')} servicios programados` : ''}
          </p>
        </div>
        <button type="button" className="train-card-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
      </div>
      <dl className="train-card-list">
        <dt>Recorrido</dt>
        <dd>
          {from} → {to}
        </dd>
        {middle.length > 0 && (
          <>
            <dt>Paradas</dt>
            <dd>{middle.join(', ')}</dd>
          </>
        )}
      </dl>
      <BookButton onClick={onBook} />
    </div>
  );
}

/** Botón «Comprar billete» de las fichas del mapa (alternativa al doble clic, útil en móvil). */
export function BookButton({ onClick }) {
  return (
    <button type="button" className="btn btn-small card-book" onClick={onClick}>
      Comprar billete
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <path d="M10 4 V16 M4.5 10.5 L10 16 L15.5 10.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
