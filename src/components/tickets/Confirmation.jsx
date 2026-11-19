import { fmtPrice } from '../../lib/timetable.js';

/** Pantalla final con el localizador de la reserva (simulada). */
export default function Confirmation({ booking, onRestart }) {
  return (
    <div className="card confirmation" role="status">
      <div className="confirmation-check" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="28" height="28">
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3>¡Reserva confirmada!</h3>
      <p>
        Localizador <strong className="locator">{booking.locator}</strong>
      </p>
      <p>
        Hemos enviado los billetes a <strong>{booking.email}</strong>. Total: <strong>{fmtPrice(booking.total)}</strong>.
      </p>
      <p className="summary-note">Esto es una demostración: no se ha realizado ningún cobro ni se ha enviado ningún correo.</p>
      <button type="button" className="btn" onClick={onRestart}>
        Nueva búsqueda
      </button>
    </div>
  );
}
