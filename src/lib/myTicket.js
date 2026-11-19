/**
 * «Mi billete»: reconstruye el viaje de un billete de tren a partir de los horarios oficiales de Renfe
 * (public/data/timetable.json, ya descargado en el navegador). Todo se calcula en el dispositivo:
 * el billete no se envía a ningún servidor.
 *
 * Solo trenes: los horarios de Renfe que usamos solo contienen trenes (AVE, AVLO, Euromed, Intercity,
 * AVANT, Regionales…). Si un billete incluye un tramo en autobús, no está en estos datos y se ignora.
 */
import { addDays, dayIndex, fmtDate, runsOn, searchTrains } from './timetable.js';

/** «3192» → «03192»: Renfe numera los trenes con 5 cifras. */
export const normTrain = (n) => String(n ?? '').replace(/\D/g, '').padStart(5, '0').slice(-5);

// ---------- Hora de Madrid ----------

/** Minutos de diferencia entre Madrid y UTC en un instante dado (60 en invierno, 120 en verano). */
function madridOffsetMin(utcMs) {
  const tz = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', timeZoneName: 'shortOffset' })
    .formatToParts(new Date(utcMs))
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(tz ?? '');
  if (!m) return 60;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Instante (ms) de «fecha YYYY-MM-DD + minutos desde medianoche» en hora de Madrid. */
export function madridEpoch(iso, minutes) {
  const [y, mo, d] = iso.split('-').map(Number);
  const naive = Date.UTC(y, mo - 1, d) + minutes * 60_000;
  return naive - madridOffsetMin(naive) * 60_000;
}

/** Fecha de hoy en Madrid (YYYY-MM-DD). */
export function madridToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// ---------- Itinerario ----------

const cityOfStation = (tt, si) => tt.stations[si].city;

/**
 * Viaje de un billete: { date, legs: [{ number, from: [ids] | null, to: [ids] | null }] }.
 * `from` / `to` son estaciones (índices de timetable.stations) para desambiguar; si faltan, se deducen:
 * el origen de un tramo es la llegada del anterior y el destino es donde se coge el tren siguiente.
 * Devuelve { ok: true, itinerary } o { ok: false, error, legIndex }.
 */
export function buildItinerary(tt, ticket) {
  const day = dayIndex(tt, ticket.date);
  if (day < 0 || day >= tt.days) {
    return { ok: false, error: `Solo tenemos horarios entre el ${fmtDate(tt.base)} y el ${fmtDate(addDays(tt.base, tt.days - 1))}.` };
  }

  // Variantes de cada tren que circulan ese día (un mismo número puede tener recorridos distintos).
  const variants = [];
  for (const [i, leg] of ticket.legs.entries()) {
    const number = normTrain(leg.number);
    const list = tt.trains.filter((t) => t.n === number && runsOn(t, day));
    if (!list.length) return { ok: false, legIndex: i, error: `El tren ${number} no circula el ${fmtDate(ticket.date, { day: 'numeric', month: 'long' })}.` };
    variants.push(list);
  }

  const legs = [];
  for (const [i, leg] of ticket.legs.entries()) {
    const prev = legs[i - 1];
    const nextVariants = variants[i + 1];
    let best = null;

    for (const v of variants[i]) {
      // Origen: el indicado, o la estación (o ciudad) donde terminó el tramo anterior, o la cabecera.
      const fromSet = leg.from?.length ? new Set(leg.from) : null;
      let fromIdx = 0;
      if (fromSet) fromIdx = v.s.findIndex(([si]) => fromSet.has(si));
      else if (prev) {
        fromIdx = v.s.findIndex(([si]) => si === prev.toId);
        if (fromIdx < 0) fromIdx = v.s.findIndex(([si]) => cityOfStation(tt, si) === cityOfStation(tt, prev.toId));
      }
      if (fromIdx < 0) continue;
      if (prev && v.s[fromIdx][2] < prev.arr) continue; // el tren siguiente tiene que salir después de llegar

      // Destino: el indicado, o la primera parada donde se puede coger el tren siguiente, o el final.
      let toIdx = -1;
      if (leg.to?.length) {
        const toSet = new Set(leg.to);
        toIdx = v.s.findIndex(([si], k) => k > fromIdx && toSet.has(si));
      } else if (nextVariants) {
        let bestWait = Infinity;
        for (let k = fromIdx + 1; k < v.s.length; k++) {
          const [si, arr] = v.s[k];
          for (const nv of nextVariants) {
            const j = nv.s.findIndex(([nsi]) => nsi === si || cityOfStation(tt, nsi) === cityOfStation(tt, si));
            if (j < 0 || j === nv.s.length - 1) continue;
            const wait = nv.s[j][2] - arr;
            if (wait >= 0 && wait < bestWait) {
              bestWait = wait;
              toIdx = k;
            }
          }
        }
      } else toIdx = v.s.length - 1;
      if (toIdx <= fromIdx) continue;

      const candidate = { v, fromIdx, toIdx };
      // Si hay varias variantes posibles, la que tiene más paradas en el tramo.
      if (!best || toIdx - fromIdx > best.toIdx - best.fromIdx) best = candidate;
    }

    const number = normTrain(leg.number);
    if (!best) {
      return {
        ok: false,
        legIndex: i,
        error: prev
          ? `No encontramos cómo enlazar el tren ${prev.number} con el ${number}. Indica las estaciones de cada tramo.`
          : `El tren ${number} no para en la estación indicada ese día. Revisa el origen y el destino.`,
      };
    }

    const { v, fromIdx, toIdx } = best;
    const stops = v.s.slice(fromIdx, toIdx + 1).map(([si, arr, dep]) => ({ id: si, name: tt.stations[si].name, arr, dep }));
    legs.push({
      number,
      type: tt.types[v.t],
      fromId: v.s[fromIdx][0],
      toId: v.s[toIdx][0],
      from: tt.stations[v.s[fromIdx][0]].name,
      to: tt.stations[v.s[toIdx][0]].name,
      dep: v.s[fromIdx][2],
      arr: v.s[toIdx][1],
      stops,
    });
  }

  const transfers = legs.slice(1).map((next, i) => {
    const cur = legs[i];
    return {
      at: cur.to,
      nextFrom: next.from,
      sameStation: cur.toId === next.fromId,
      minutes: next.dep - cur.arr,
      nextNumber: next.number,
    };
  });

  return { ok: true, itinerary: { date: ticket.date, legs, transfers } };
}

// ---------- Incidencias: retraso simulado y alternativas ----------

/**
 * Parámetro de prueba ?retraso= para enseñar cómo se ve una incidencia sin esperar a que ocurra:
 *   ?retraso=25            → 25 min de retraso en el primer tren del billete
 *   ?retraso=05668:25      → 25 min en el tren 05668 (se pueden poner varios separados por comas)
 *   ?retraso=perder        → el retraso justo para perder el primer transbordo (para demostraciones)
 * Devuelve { número de tren: minutos } o null si no se ha pedido.
 */
export function simulatedDelays(itinerary) {
  const raw = new URLSearchParams(window.location.search).get('retraso');
  if (!raw || !itinerary) return null;
  if (raw === 'perder' && itinerary.transfers[0]) return { [itinerary.legs[0].number]: itinerary.transfers[0].minutes + 8 };
  const out = {};
  for (const part of raw.split(',')) {
    const [a, b] = part.split(':').map((x) => x.trim());
    if (b === undefined && /^\d+$/.test(a)) out[itinerary.legs[0].number] = Number(a);
    else if (/^\d+$/.test(a) && /^\d+$/.test(b ?? '')) out[normTrain(a)] = Number(b);
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Si se pierde un transbordo: próximos trenes desde la estación del transbordo hasta el destino final
 * que salen después de la llegada prevista (con el retraso) más el tiempo mínimo para cambiar.
 */
export function alternativesAfter(tt, itinerary, transferIndex, earliestMin, limit = 3) {
  const from = itinerary.legs[transferIndex].toId;
  const to = itinerary.legs.at(-1).toId;
  const seen = new Set();
  return searchTrains(tt, [from], [to], itinerary.date)
    .filter((r) => r.dep >= earliestMin && r.number !== itinerary.legs[transferIndex + 1].number)
    // Renfe a veces da dos números al mismo tren (mismas horas y tipo): se muestra una vez.
    .filter((r) => {
      const key = `${r.dep}-${r.arr}-${r.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

// ---------- Ejemplo para probar (horarios reales de hoy o mañana) ----------

/** Distancia aproximada (en grados «aplanados») entre dos estaciones, para descartar rodeos. */
const dist = (tt, a, b) => {
  const s1 = tt.stations[a];
  const s2 = tt.stations[b];
  return Math.hypot((s1.lon - s2.lon) * Math.cos((s1.lat * Math.PI) / 180), s1.lat - s2.lat);
};

/**
 * Busca en los horarios un viaje real con un transbordo para enseñar cómo funciona la página:
 * un tren que sale de Madrid y, en una de sus paradas, otro tren distinto que sale 15–40 min después.
 * Se prefieren viajes que avanzan hacia el destino (sin rodeos) y con más trenes después en ese trayecto,
 * para que, si se simula un retraso, haya alternativas que enseñar.
 */
export function exampleTicket(tt) {
  const today = madridToday();
  const nowMin = (() => {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    const [h, m] = p.split(':').map(Number);
    return h * 60 + m;
  })();
  for (const [offset, after] of [
    [0, nowMin + 20],
    [1, 0],
  ]) {
    const date = addDays(today, offset);
    const day = dayIndex(tt, date);
    if (day < 0 || day >= tt.days) continue;
    const running = tt.trains.filter((t) => runsOn(t, day));
    let fallback = null;
    for (const a of running) {
      const origin = a.s[0][0];
      if (cityOfStation(tt, origin) !== 'Madrid' || a.s[0][2] < after || a.s.length < 3) continue;
      for (let k = 1; k < a.s.length; k++) {
        const [si, arr] = a.s[k];
        for (const b of running) {
          if (b.n === a.n) continue;
          const j = b.s.findIndex(([x]) => x === si);
          if (j < 0 || j === b.s.length - 1) continue;
          const wait = b.s[j][2] - arr;
          if (wait < 15 || wait > 40) continue;
          const end = b.s.at(-1)[0];
          // Sin rodeos: el destino está más lejos del origen que el transbordo, y más cerca del transbordo que del origen.
          if (cityOfStation(tt, end) === cityOfStation(tt, origin)) continue;
          if (!(dist(tt, origin, end) > dist(tt, origin, si) && dist(tt, si, end) < dist(tt, origin, end))) continue;
          const ticket = {
            date,
            legs: [
              { number: a.n, from: [origin], to: [si] },
              { number: b.n, from: [si], to: [end] },
            ],
          };
          const later = searchTrains(tt, [si], [end], date).filter((r) => r.dep > b.s[j][2] && r.number !== b.n);
          if (later.length) return ticket;
          fallback ??= ticket;
        }
      }
    }
    if (fallback) return fallback;
  }
  return null;
}

// ---------- Guardar en el dispositivo (solo si el usuario lo pide) ----------

const STORAGE_KEY = 'viaclara:mi-billete';

/** Solo el itinerario mínimo: fecha, números de tren y estaciones. Nada personal. */
const minimal = (ticket) => ({
  date: ticket.date,
  legs: ticket.legs.map((l) => ({ number: normTrain(l.number), from: l.from ?? null, to: l.to ?? null })),
});

export function saveTrip(ticket, endsAt) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, ticket: minimal(ticket), expires: endsAt + 30 * 60_000 }));
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Viaje guardado; si ya terminó, se borra solo. */
export function loadTrip() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!raw?.ticket) return null;
    if (Date.now() > raw.expires) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return raw.ticket;
  } catch {
    return null;
  }
}

export function clearTrip() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}

export const hasSavedTrip = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) != null;
  } catch {
    return false;
  }
};
