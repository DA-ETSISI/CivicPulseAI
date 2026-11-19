import { useState } from 'react';
import StationInput from './StationInput.jsx';
import PassengerPicker from './PassengerPicker.jsx';
import { fmtDate } from '../../lib/timetable.js';

/** Buscador: origen, destino, ida / ida y vuelta, fechas y viajeros. */
export default function SearchForm({ timetable, minDate, initial, onSearch }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = (e) => {
    e.preventDefault();
    const err = {};
    if (!form.from) err.from = 'Elige la estación de origen';
    if (!form.to) err.to = 'Elige la estación de destino';
    if (form.from && form.to && form.from.ids.some((i) => form.to.ids.includes(i))) err.to = 'El destino debe ser distinto del origen';
    if (form.roundTrip && form.dateBack < form.dateOut) err.dateBack = 'La vuelta no puede ser antes que la ida';
    setErrors(err);
    if (!Object.keys(err).length) onSearch(form);
  };

  const swap = () => set({ from: form.to, to: form.from });

  return (
    <form className="card search-card" onSubmit={submit} noValidate>
      <div className="trip-type" role="radiogroup" aria-label="Tipo de viaje">
        {[
          [false, 'Solo ida'],
          [true, 'Ida y vuelta'],
        ].map(([value, label]) => (
          <label key={label} className={`trip-option${form.roundTrip === value ? ' is-on' : ''}`}>
            <input
              type="radio"
              name="trip-type"
              checked={form.roundTrip === value}
              onChange={() => set({ roundTrip: value, dateBack: value && form.dateBack < form.dateOut ? form.dateOut : form.dateBack })}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="search-grid">
        <div className="od-group">
          <StationInput
            label="Origen"
            placeholder="¿Desde dónde?"
            options={timetable.options}
            value={form.from}
            invalid={errors.from}
            onChange={(from) => set({ from })}
          />
          <button type="button" className="swap" onClick={swap} aria-label="Intercambiar origen y destino" title="Intercambiar">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M7 7h12m0 0-4-4m4 4-4 4M17 17H5m0 0 4-4m-4 4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <StationInput
            label="Destino"
            placeholder="¿A dónde vas?"
            options={timetable.options}
            value={form.to}
            invalid={errors.to}
            onChange={(to) => set({ to })}
          />
        </div>

        <div className="field">
          <label htmlFor="date-out">Fecha de ida</label>
          <input
            id="date-out"
            type="date"
            min={minDate}
            max={timetable.maxDate}
            value={form.dateOut}
            onChange={(e) =>
              e.target.value &&
              set({ dateOut: e.target.value, dateBack: form.dateBack < e.target.value ? e.target.value : form.dateBack })
            }
          />
        </div>

        <div className={`field${form.roundTrip ? '' : ' is-disabled'}${errors.dateBack ? ' is-invalid' : ''}`}>
          <label htmlFor="date-back">Fecha de vuelta</label>
          <input
            id="date-back"
            type="date"
            min={form.dateOut}
            max={timetable.maxDate}
            value={form.roundTrip ? form.dateBack : ''}
            disabled={!form.roundTrip}
            onChange={(e) => e.target.value && set({ dateBack: e.target.value })}
          />
        </div>

        <PassengerPicker value={form.pax} onChange={(pax) => set({ pax })} />

        <button type="submit" className="btn btn-search">
          Buscar billete
        </button>
      </div>

      {Object.values(errors).length > 0 && (
        <p className="form-error" role="alert">
          {Object.values(errors).join(' · ')}
        </p>
      )}
      <p className="form-hint">
        Horarios oficiales disponibles hasta el {fmtDate(timetable.maxDate, { day: 'numeric', month: 'long', year: 'numeric' })}.
      </p>
    </form>
  );
}
