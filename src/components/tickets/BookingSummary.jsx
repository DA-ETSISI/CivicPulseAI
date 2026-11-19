import { fmtDate, fmtPrice, fmtTime, paxLabel, payingUnits } from '../../lib/timetable.js';

export const legTotal = (leg, pax) => (leg ? leg.fare.price * payingUnits(pax) : 0);

function Leg({ label, leg, date, pax, onEdit }) {
  if (!leg) {
    return (
      <div className="summary-leg is-empty">
        <span className="eyebrow">{label}</span>
        <p>{fmtDate(date)} · Elige un tren</p>
      </div>
    );
  }
  return (
    <div className="summary-leg">
      <div className="summary-leg-head">
        <span className="eyebrow">{label}</span>
        {onEdit && (
          <button type="button" className="link" onClick={onEdit}>
            Cambiar
          </button>
        )}
      </div>
      <p className="summary-route">
        {fmtTime(leg.train.dep)} {leg.train.from} → {fmtTime(leg.train.arr)} {leg.train.to}
      </p>
      <p className="summary-meta">
        {fmtDate(date)} · {leg.train.type} {leg.train.number} · {leg.fare.label}
      </p>
      <p className="summary-price">{fmtPrice(legTotal(leg, pax))}</p>
    </div>
  );
}

/** Resumen lateral de la compra: trayectos elegidos, viajeros y total. */
export default function BookingSummary({ query, outbound, inbound, onEditOutbound, onEditInbound }) {
  const total = legTotal(outbound, query.pax) + legTotal(inbound, query.pax);
  return (
    <aside className="card summary" aria-label="Resumen del viaje">
      <h3>Tu viaje</h3>
      <p className="summary-od">
        {query.from.label} → {query.to.label}
      </p>
      <p className="summary-meta">{paxLabel(query.pax)}</p>
      <Leg label="Ida" leg={outbound} date={query.dateOut} pax={query.pax} onEdit={onEditOutbound} />
      {query.roundTrip && <Leg label="Vuelta" leg={inbound} date={query.dateBack} pax={query.pax} onEdit={onEditInbound} />}
      <div className="summary-total">
        <span>Total</span>
        <strong>{fmtPrice(total)}</strong>
      </div>
      <p className="summary-note">Precio orientativo. Horarios reales de Renfe Data.</p>
    </aside>
  );
}
