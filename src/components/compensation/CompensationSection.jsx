import { useEffect, useMemo, useState } from 'react';
import CompensationForm from './CompensationForm.jsx';
import CompensationResult from './CompensationResult.jsx';
import ClaimGuide from './ClaimGuide.jsx';
import PassengerRights from './PassengerRights.jsx';
import { claimSummary, claimWindow, computeCompensation, computeDelay } from '../../lib/compensation.js';
import { loadTimetable, todayIso } from '../../lib/timetable.js';
import '../../styles/compensation.css';

const EMPTY_FORM = {
  from: null,
  to: null,
  typeId: 'ave',
  trainNumber: '',
  travelDate: '',
  price: '',
  departure: '',
  scheduledArrival: '',
  actualArrival: '',
  cause: 'unknown',
};

/**
 * Apartado «Compensaciones» de Incidencias: calculadora de lo que te devuelven por un retraso,
 * guía para reclamar y resumen de los derechos del pasajero.
 */
export default function CompensationSection() {
  // La fecha por defecto es hoy (se calcula al abrir el apartado, no al cargar la web).
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, travelDate: todayIso() }));
  const [stations, setStations] = useState(null);

  // Estaciones para el autocompletado (si no cargan, el formulario usa campos de texto).
  useEffect(() => {
    let cancelled = false;
    loadTimetable()
      .then((tt) => !cancelled && setStations(tt.options))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const timing = useMemo(() => computeDelay(form), [form]);
  const allTimes = form.departure && form.scheduledArrival && form.actualArrival;

  const result = useMemo(() => {
    if (!timing.ok) return null;
    const price = form.price === '' ? null : Number(String(form.price).replace(',', '.'));
    return computeCompensation({ typeId: form.typeId, delay: timing.delay, price, cause: form.cause, travelDate: form.travelDate });
  }, [timing, form.price, form.typeId, form.cause, form.travelDate]);

  const claim = useMemo(() => (timing.ok ? claimWindow(form.travelDate, timing.arrivalAbs) : null), [timing, form.travelDate]);

  const summary = result
    ? claimSummary({ ...form, from: form.from?.label, to: form.to?.label, result })
    : '';

  return (
    <div className="comp" id="compensaciones">
      <div className="page-head">
        <p className="eyebrow">Compensaciones</p>
        <h2 className="section-title">¿Tu tren llegó tarde? Calcula lo que te devuelven</h2>
        <p>
          Introduce los datos de tu billete y te decimos qué porcentaje te corresponde según las normas oficiales de Renfe y la ley
          europea, cuánto dinero es y hasta cuándo puedes pedirlo.
        </p>
      </div>

      <div className="comp-layout">
        <CompensationForm
          form={form}
          onChange={setForm}
          stations={stations}
          maxDate={todayIso()}
          error={allTimes && !timing.ok ? timing.error : null}
        />
        <CompensationResult result={result} window={claim} summary={summary} />
      </div>

      <div className="comp-layout comp-layout--info">
        <ClaimGuide />
        <PassengerRights />
      </div>
    </div>
  );
}
