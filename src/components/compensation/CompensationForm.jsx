import StationInput from '../tickets/StationInput.jsx';
import { CAUSES, TRAIN_TYPES } from '../../lib/compensation.js';

/** Tipos de billete agrupados para el desplegable. */
const GROUPS = TRAIN_TYPES.reduce((acc, t) => {
  (acc[t.group] ??= []).push(t);
  return acc;
}, {});

/**
 * Datos del billete: trayecto, tren, fecha, horas y precio.
 * Si los horarios de Renfe están cargados, origen y destino se eligen con autocompletado;
 * si no, son campos de texto normales.
 */
export default function CompensationForm({ form, onChange, stations, maxDate, error }) {
  const set = (patch) => onChange({ ...form, ...patch });

  return (
    <form className="card comp-form" onSubmit={(e) => e.preventDefault()} noValidate>
      <h3 className="comp-card-title">
        <span className="comp-step">1</span> Datos de tu billete
      </h3>

      <div className="comp-grid comp-grid--route">
        {stations ? (
          <>
            <StationInput label="Origen" placeholder="¿Desde dónde?" options={stations} value={form.from} onChange={(from) => set({ from })} />
            <StationInput label="Destino" placeholder="¿A dónde?" options={stations} value={form.to} onChange={(to) => set({ to })} />
          </>
        ) : (
          <>
            <TextField id="comp-from" label="Origen" value={form.from?.label ?? ''} onChange={(v) => set({ from: v ? { label: v } : null })} />
            <TextField id="comp-to" label="Destino" value={form.to?.label ?? ''} onChange={(v) => set({ to: v ? { label: v } : null })} />
          </>
        )}
      </div>

      <div className="comp-grid">
        <div className="field">
          <label htmlFor="comp-type">Tipo de tren</label>
          <select id="comp-type" value={form.typeId} onChange={(e) => set({ typeId: e.target.value })}>
            {Object.entries(GROUPS).map(([group, types]) => (
              <optgroup key={group} label={group}>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <TextField
          id="comp-number"
          label="Nº de tren (opcional)"
          placeholder="p. ej. 02150"
          inputMode="numeric"
          value={form.trainNumber}
          onChange={(trainNumber) => set({ trainNumber: trainNumber.replace(/[^\dA-Za-z]/g, '').slice(0, 6) })}
        />
        <div className="field">
          <label htmlFor="comp-date">Fecha del viaje</label>
          <input id="comp-date" type="date" max={maxDate} value={form.travelDate} onChange={(e) => e.target.value && set({ travelDate: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="comp-price">Precio del billete (€)</label>
          <input
            id="comp-price"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="p. ej. 45,90"
            value={form.price}
            onChange={(e) => set({ price: e.target.value })}
          />
        </div>
      </div>

      <div className={`comp-grid comp-grid--times${error ? ' is-invalid' : ''}`}>
        <TimeField id="comp-dep" label="Hora de salida" value={form.departure} onChange={(departure) => set({ departure })} />
        <TimeField id="comp-sched" label="Llegada prevista" value={form.scheduledArrival} onChange={(scheduledArrival) => set({ scheduledArrival })} />
        <TimeField id="comp-real" label="Llegada real" value={form.actualArrival} onChange={(actualArrival) => set({ actualArrival })} highlight />
      </div>

      <div className="field comp-cause">
        <label htmlFor="comp-cause">¿Por qué se retrasó? (si lo sabes)</label>
        <select id="comp-cause" value={form.cause} onChange={(e) => set({ cause: e.target.value })}>
          {CAUSES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="form-hint">Las horas vienen en tu billete. La llegada real puedes verla en la app de Renfe o en el justificante de retraso.</p>
    </form>
  );
}

function TextField({ id, label, value, onChange, ...rest }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

function TimeField({ id, label, value, onChange, highlight }) {
  return (
    <div className={`field${highlight ? ' comp-time-real' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="time" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
