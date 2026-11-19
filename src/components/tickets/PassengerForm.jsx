import { useState } from 'react';

const travellers = (pax) => [
  ...Array.from({ length: pax.adults }, (_, i) => `Adulto ${i + 1}`),
  ...Array.from({ length: pax.children }, (_, i) => `Niño ${i + 1}`),
  ...Array.from({ length: pax.infants }, (_, i) => `Bebé ${i + 1}`),
];

/** Datos de los viajeros y de contacto. */
export default function PassengerForm({ pax, onBack, onConfirm }) {
  const list = travellers(pax);
  const [accepted, setAccepted] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }
    const data = new FormData(e.currentTarget);
    onConfirm({ email: data.get('email'), name: data.get('name-0') });
  };

  return (
    <form className="card passenger-form" onSubmit={submit}>
      <h3>Datos de los viajeros</h3>
      {list.map((who, i) => (
        <fieldset key={who}>
          <legend>{who}</legend>
          <div className="form-row">
            <div className="field">
              <label htmlFor={`name-${i}`}>Nombre</label>
              <input id={`name-${i}`} name={`name-${i}`} required autoComplete={i === 0 ? 'given-name' : 'off'} />
            </div>
            <div className="field">
              <label htmlFor={`surname-${i}`}>Apellidos</label>
              <input id={`surname-${i}`} name={`surname-${i}`} required autoComplete={i === 0 ? 'family-name' : 'off'} />
            </div>
            {!who.startsWith('Bebé') && (
              <div className="field">
                <label htmlFor={`doc-${i}`}>DNI / NIE / Pasaporte</label>
                <input id={`doc-${i}`} name={`doc-${i}`} required minLength={5} />
              </div>
            )}
          </div>
        </fieldset>
      ))}

      <fieldset>
        <legend>Contacto</legend>
        <div className="form-row">
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="phone">Teléfono</label>
            <input id="phone" name="phone" type="tel" required autoComplete="tel" pattern="[0-9 +]{9,15}" />
          </div>
        </div>
      </fieldset>

      <label className="check">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required />
        Acepto las condiciones de transporte (versión de demostración: no se realiza ningún pago).
      </label>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Volver
        </button>
        <button type="submit" className="btn">
          Confirmar compra
        </button>
      </div>
    </form>
  );
}
