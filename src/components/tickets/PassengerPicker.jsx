import { useEffect, useRef, useState } from 'react';
import { paxLabel } from '../../lib/timetable.js';

const ROWS = [
  { id: 'adults', label: 'Adultos', hint: 'Desde 14 años', min: 1 },
  { id: 'children', label: 'Niños', hint: 'De 4 a 13 años', min: 0 },
  { id: 'infants', label: 'Bebés', hint: 'Menores de 4 años', min: 0 },
];
const MAX = 9;

/** Selector de viajeros con contadores. */
export default function PassengerPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const total = value.adults + value.children + value.infants;
  const canAdd = (id) => total < MAX && (id !== 'infants' || value.infants < value.adults);
  const canRemove = (row) => value[row.id] > row.min && !(row.id === 'adults' && value.infants >= value.adults);
  const change = (id, delta) => onChange({ ...value, [id]: value[id] + delta });

  return (
    <div className="field pax-field" ref={ref}>
      <span className="field-label">Viajeros</span>
      <button type="button" className="pax-button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {paxLabel(value)}
      </button>
      {open && (
        <div className="pax-popover" role="dialog" aria-label="Número de viajeros">
          {ROWS.map((row) => (
            <div key={row.id} className="pax-row">
              <div>
                <strong>{row.label}</strong>
                <small>{row.hint}</small>
              </div>
              <div className="stepper">
                <button type="button" aria-label={`Quitar ${row.label}`} disabled={!canRemove(row)} onClick={() => change(row.id, -1)}>
                  −
                </button>
                <span aria-live="polite">{value[row.id]}</span>
                <button type="button" aria-label={`Añadir ${row.label}`} disabled={!canAdd(row.id)} onClick={() => change(row.id, 1)}>
                  +
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-small" onClick={() => setOpen(false)}>
            Listo
          </button>
        </div>
      )}
    </div>
  );
}
