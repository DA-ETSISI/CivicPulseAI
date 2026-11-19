import { useState } from 'react';
import StationInput from '../tickets/StationInput.jsx';

const emptyLeg = () => ({ number: '', from: null, to: null, withStations: false });

/**
 * Entrada manual mínima: fecha y número de cada tren. Las estaciones solo hacen falta si un número
 * de tren tiene varios recorridos ese día o para enlazar un transbordo poco claro.
 */
export default function TicketForm({ timetable, minDate, maxDate, defaultDate, failedLeg, onSubmit }) {
  const [date, setDate] = useState(defaultDate);
  const [legs, setLegs] = useState([emptyLeg()]);
  const [invalid, setInvalid] = useState(false);

  const update = (i, patch) => setLegs((all) => all.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = (e) => {
    e.preventDefault();
    const ok = legs.every((l) => /^\d{3,5}$/.test(l.number.trim()));
    setInvalid(!ok);
    if (!ok) return;
    onSubmit({
      date,
      legs: legs.map((l) => ({ number: l.number.trim(), from: l.from?.ids ?? null, to: l.to?.ids ?? null })),
    });
  };

  return (
    <form className="ticket-form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="ticket-date">Fecha del viaje</label>
        <input id="ticket-date" type="date" value={date} min={minDate} max={maxDate} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </div>

      <ol className="ticket-legs">
        {legs.map((leg, i) => (
          <li key={i} className={`ticket-leg${failedLeg === i ? ' is-invalid' : ''}`}>
            <div className="ticket-leg-row">
              <div className={`field${invalid && !/^\d{3,5}$/.test(leg.number.trim()) ? ' is-invalid' : ''}`}>
                <label htmlFor={`train-${i}`}>{legs.length > 1 ? `Tren ${i + 1}` : 'Número de tren'}</label>
                <input
                  id={`train-${i}`}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ej. 03063"
                  maxLength={5}
                  value={leg.number}
                  onChange={(e) => update(i, { number: e.target.value.replace(/\D/g, '') })}
                />
              </div>
              {legs.length > 1 && (
                <button type="button" className="link" onClick={() => setLegs((all) => all.filter((_, j) => j !== i))}>
                  Quitar
                </button>
              )}
            </div>

            {leg.withStations || failedLeg === i ? (
              <div className="ticket-stations">
                <StationInput label="Sube en" placeholder="Estación de origen" options={timetable.options} value={leg.from} onChange={(from) => update(i, { from })} />
                <StationInput label="Baja en" placeholder="Estación de destino" options={timetable.options} value={leg.to} onChange={(to) => update(i, { to })} />
              </div>
            ) : (
              <button type="button" className="link" onClick={() => update(i, { withStations: true })}>
                Indicar estaciones (si el tren tiene varios recorridos)
              </button>
            )}
          </li>
        ))}
      </ol>

      {invalid && (
        <p className="ticket-error" role="alert">
          Escribe el número de cada tren (entre 3 y 5 cifras), tal como aparece en el billete.
        </p>
      )}

      <div className="ticket-form-actions">
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setLegs((all) => [...all, emptyLeg()])}>
          + Añadir otro tren (transbordo)
        </button>
        <button type="submit" className="btn">
          Ver mi viaje
        </button>
      </div>
    </form>
  );
}
