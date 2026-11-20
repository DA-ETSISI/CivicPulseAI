/**
 * Modo demo de «Mi billete». Se carga solo bajo demanda (import dinámico): en desarrollo con el enlace
 * de ejemplo o ?demo=, y siempre en la pestaña «Billete prueba» (también en el build de producción).
 *
 * Carga viajes ficticios de `mi-billete-demo.json` directamente como itinerario, con sus incidencias
 * (retrasos, cancelaciones, cambios de vía), y un reloj simulado para ver la cuenta atrás en cada momento.
 * Todo se pinta con los componentes reales de la página; aquí no hay pantallas falsas.
 */
import fixture from './mi-billete-demo.json';
import { madridEpoch, madridToday } from '../lib/myTicket.js';
import { fmtTime } from '../lib/timetable.js';

export const SCENARIOS = fixture.scenarios;

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Viaje del fixture → el mismo formato que devuelve buildItinerary (fecha de hoy, para que la cuenta atrás tenga sentido). */
function buildTrip(trip, date) {
  const legs = trip.legs.map((l) => {
    const stops = l.stops.map((s) => ({ id: s.name, name: s.name, lat: s.lat, lon: s.lon, arr: toMin(s.arr ?? s.dep), dep: toMin(s.dep ?? s.arr) }));
    return {
      number: l.number,
      type: l.type,
      platform: l.platform ?? null,
      fromId: stops[0].id,
      toId: stops.at(-1).id,
      from: stops[0].name,
      to: stops.at(-1).name,
      dep: stops[0].dep,
      arr: stops.at(-1).arr,
      stops,
    };
  });
  const transfers = legs.slice(1).map((next, i) => ({
    at: legs[i].to,
    nextFrom: next.from,
    sameStation: legs[i].toId === next.fromId,
    minutes: next.dep - legs[i].arr,
    nextNumber: next.number,
  }));
  return { date, legs, transfers };
}

/** Escenario → { id, itinerary, delays, incidents, alternatives, clockMin, range }. */
export function loadScenario(id) {
  const sc = SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
  const trip = fixture.trips[sc.trip];
  const itinerary = buildTrip(trip, madridToday());
  const alternatives = (trip.alternatives ?? []).map((list) =>
    list.map((a) => ({ ...a, id: `demo-${a.number}`, dep: toMin(a.dep), arr: toMin(a.arr) })),
  );
  return {
    id: sc.id,
    itinerary,
    delays: sc.delays ?? {},
    incidents: sc.incidents ?? {},
    alternatives,
    clockMin: toMin(sc.clock),
    range: [itinerary.legs[0].dep - 60, itinerary.legs.at(-1).arr + 60],
  };
}

/** ?hora=HH:MM de la URL (minutos desde medianoche) o null. */
export function clockFromUrl() {
  const v = new URLSearchParams(window.location.search).get('hora');
  return v && /^\d{1,2}:\d{2}$/.test(v) ? toMin(v) : null;
}

/** Escenario pedido con ?demo=1 (el normal) o ?demo=<id>; null si no se ha pedido. */
export function scenarioFromUrl() {
  const v = new URLSearchParams(window.location.search).get('demo');
  if (!v) return null;
  return SCENARIOS.some((s) => s.id === v) ? v : SCENARIOS[0].id;
}

/** Instante (ms) de un minuto del día de hoy en Madrid. */
export const clockAt = (date, minutes) => madridEpoch(date, minutes);

/** Barra del modo demo: escenario y reloj simulado. */
export function DemoPanel({ demo, now, onScenario, onClock, onExit }) {
  const dayStart = madridEpoch(demo.itinerary.date, 0);
  const minutes = Math.floor((now - dayStart) / 60_000);
  const [min, max] = demo.range;
  return (
    <div className="demo-bar" role="region" aria-label="Modo demo con datos ficticios">
      <span className="demo-tag">Demo · datos ficticios</span>
      <label className="demo-field">
        Escenario
        <select value={demo.id} onChange={(e) => onScenario(e.target.value)}>
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="demo-field demo-clock">
        Hora simulada <span className="num">{fmtTime(((minutes % 1440) + 1440) % 1440)}</span>
        <input type="range" min={min} max={max} step={1} value={Math.min(max, Math.max(min, minutes))} onChange={(e) => onClock(Number(e.target.value))} />
      </label>
      <button type="button" className="link" onClick={onExit}>
        Salir de la demo
      </button>
    </div>
  );
}
