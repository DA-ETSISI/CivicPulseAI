import { useEffect, useState } from 'react';

/**
 * ¿Está una línea en servicio ahora mismo?
 * Cada línea trae `service[d]`: tramos [[inicio, fin], …] en minutos desde la medianoche del día `base + d`
 * (generados con `npm run data` a partir del calendario oficial de Renfe, festivos incluidos).
 * Un tren que sale antes de medianoche y llega después alarga el día anterior (fin > 1440).
 */

const toUtc = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const addDays = (iso, n) => new Date(toUtc(iso) + n * 86400000).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((toUtc(a) - toUtc(b)) / 86400000);

/** Fecha (YYYY-MM-DD) y minuto del día en Madrid. */
function madridNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Parámetros de depuración: ?hora=03:00 y, opcionalmente, ?fecha=2026-11-20. */
function readOverride() {
  const q = new URLSearchParams(window.location.search);
  const hora = /^(\d{1,2}):(\d{2})$/.exec(q.get('hora') ?? '');
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(q.get('fecha') ?? '') ? q.get('fecha') : null;
  if (!hora && !fecha) return null;
  return { minutes: hora ? Number(hora[1]) * 60 + Number(hora[2]) : null, date: fecha };
}

/** Reloj de Madrid que se actualiza cada minuto (o la hora simulada si se pasa ?hora=). */
export function useServiceClock() {
  const [clock, setClock] = useState(() => compute());

  function compute() {
    const now = madridNow();
    const o = readOverride();
    return {
      date: o?.date ?? now.date,
      minutes: o?.minutes ?? now.minutes,
      simulated: Boolean(o),
    };
  }

  useEffect(() => {
    const id = setInterval(() => setClock(compute()), 60_000);
    return () => clearInterval(id);
  }, []);

  return clock;
}

export const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const intervals = (service, d) => (d >= 0 && d < service.length && service[d] ? service[d] : []);

/**
 * Estado de una línea: { state: 'active' | 'inactive' | 'unknown', next: { offset, minutes } | null, label }.
 * `offset` es 0 si el próximo tren es hoy, 1 si es mañana…
 */
export function lineStatus(service, base, covered, clock) {
  if (!service || !base) return { state: 'unknown', next: null, label: 'Sin datos de horario' };
  const d = dayDiff(clock.date, base);
  if (d < 0 || d >= covered) return { state: 'unknown', next: null, label: 'Sin datos de horario' };
  const m = clock.minutes;

  const active =
    intervals(service, d).some(([s, e]) => m >= s && m <= e) ||
    intervals(service, d - 1).some(([s, e]) => e > 1440 && m + 1440 >= s && m + 1440 <= e);
  if (active) return { state: 'active', next: null, label: 'En servicio' };

  let next = null;
  const later = intervals(service, d).filter(([s]) => s > m);
  if (later.length) next = { offset: 0, minutes: later[0][0] };
  for (let dd = d + 1; !next && dd < covered; dd++) {
    const first = intervals(service, dd)[0];
    if (first) next = { offset: dd - d, minutes: first[0] };
  }
  return { state: 'inactive', next, label: nextLabel(next, clock.date) };
}

/** «Próximo tren 05:42», «Próximo tren mañana 05:42» o «Próximo tren el sáb. 05:42». */
export function nextLabel(next, today) {
  if (!next) return 'Sin servicio próximamente';
  const time = hhmm(next.minutes);
  if (next.offset === 0) return `Próximo tren ${time}`;
  if (next.offset === 1) return `Próximo tren mañana ${time}`;
  const day = new Date(toUtc(addDays(today, next.offset))).toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'UTC' });
  return `Próximo tren el ${day} ${time}`;
}

/** Ordena: primero las líneas en servicio; dentro de cada grupo se respeta el orden de entrada. */
export function splitByService(items, getStatus) {
  const active = [];
  const inactive = [];
  for (const it of items) (getStatus(it).state === 'inactive' ? inactive : active).push(it);
  return { active, inactive };
}
