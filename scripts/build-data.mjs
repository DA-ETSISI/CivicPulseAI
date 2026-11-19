/**
 * Descarga los datos abiertos oficiales y genera los JSON ligeros que usa la web.
 *
 *   npm run data            (usa la caché de .cache/ si existe)
 *   npm run data -- --fresh (fuerza una descarga nueva)
 *
 * Fuentes:
 *  - Renfe Data (GTFS Alta Velocidad, Larga y Media Distancia): https://data.renfe.com/dataset/horarios-de-alta-velocidad-larga-distancia-y-media-distancia
 *  - Renfe Data (GTFS Cercanías y Rodalies):                     https://data.renfe.com/dataset/horarios-cercanias
 *  - Límites provinciales (derivados de IGN/CNIG):               https://github.com/codeforgermany/click_that_hood
 *  - RadarDeTrenes (tiempo real y trazado real de las vías):     https://radardetrenes.com/openapi.json
 *  - Países vecinos (Natural Earth, vía world-atlas):            https://github.com/topojson/world-atlas
 *
 * Salida en public/data/:
 *  - network.json    líneas de alta velocidad para el mapa
 *  - timetable.json  horarios de todos los trenes AV/LD/MD para el buscador de billetes
 *  - provinces.json  provincias de España
 *  - countries.json  Portugal, Francia y Andorra
 *  - cercanias.json  red de Cercanías: trazado real, color oficial, estaciones y provincias de cada línea
 * Y en server/data/:
 *  - reference.json  nombres de estaciones y trenes para el servidor de incidencias en tiempo real
 */
import { unzipSync, strFromU8, Unzip, UnzipInflate } from 'fflate';
import { geoBounds, geoCentroid, geoContains, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SOURCES = {
  ld: 'https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip',
  cer: 'https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip',
  provinces:
    'https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/spain-provinces.geojson',
  world: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json',
};

/** Tipos de tren que se dibujan en el mapa (alta velocidad de larga distancia). */
const MAP_TYPES = new Set(['AVE', 'AVLO', 'AVE Euromed']);
/** Días de calendario que se incluyen en el buscador de billetes. */
const DAYS = 90;

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.cache');
const OUT = path.join(ROOT, 'public', 'data');
const SERVER_OUT = path.join(ROOT, 'server', 'data');

// ---------- utilidades ----------

async function download(url, name) {
  const file = path.join(CACHE, name);
  if (existsSync(file) && !process.argv.includes('--fresh')) return readFile(file);
  console.log(`↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} al descargar ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(file, buf);
  return buf;
}

function unzip(buf, names) {
  const files = unzipSync(new Uint8Array(buf), { filter: (f) => names.includes(f.name) });
  return Object.fromEntries(names.map((n) => [n, files[n] ? parseCsv(strFromU8(files[n])) : []]));
}

/** CSV sencillo (GTFS): soporta comillas y recorta los espacios de relleno de Renfe. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map((h) => h.replace(/^﻿/, '').trim());
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

/** Simplificación Douglas–Peucker (en grados). */
function simplify(points, tol) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol * tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

/** "Madrid-Puerta de Atocha-Almudena Grandes" → "Madrid" */
const cityOf = (stopName) => stopName.split(/\s*-\s*/)[0].trim();

const groupBy = (arr, key) => {
  const m = new Map();
  for (const x of arr) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
};

/** "25:07:00" → 1507 minutos desde la medianoche del día de salida */
const toMinutes = (hms) => {
  const [h, m] = hms.split(':').map(Number);
  return h * 60 + m;
};

const ymd = (d) => d.toISOString().slice(0, 10).replaceAll('-', '');
const parseYmd = (s) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));

// ---------- Provincias y comunidades autónomas ----------

/** Código INE de provincia → comunidad autónoma. */
const CCAA_BY_PROVINCE = {
  '01': 'País Vasco', '02': 'Castilla-La Mancha', '03': 'Comunitat Valenciana', '04': 'Andalucía', '05': 'Castilla y León',
  '06': 'Extremadura', '07': 'Illes Balears', '08': 'Cataluña', '09': 'Castilla y León', 10: 'Extremadura', 11: 'Andalucía',
  12: 'Comunitat Valenciana', 13: 'Castilla-La Mancha', 14: 'Andalucía', 15: 'Galicia', 16: 'Castilla-La Mancha', 17: 'Cataluña',
  18: 'Andalucía', 19: 'Castilla-La Mancha', 20: 'País Vasco', 21: 'Andalucía', 22: 'Aragón', 23: 'Andalucía', 24: 'Castilla y León',
  25: 'Cataluña', 26: 'La Rioja', 27: 'Galicia', 28: 'Comunidad de Madrid', 29: 'Andalucía', 30: 'Región de Murcia', 31: 'Navarra',
  32: 'Galicia', 33: 'Asturias', 34: 'Castilla y León', 35: 'Canarias', 36: 'Galicia', 37: 'Castilla y León', 38: 'Canarias',
  39: 'Cantabria', 40: 'Castilla y León', 41: 'Andalucía', 42: 'Castilla y León', 43: 'Cataluña', 44: 'Aragón',
  45: 'Castilla-La Mancha', 46: 'Comunitat Valenciana', 47: 'Castilla y León', 48: 'País Vasco', 49: 'Castilla y León',
  50: 'Aragón', 51: 'Ceuta', 52: 'Melilla',
};
const INTERNATIONAL = 'Internacional';

/**
 * Devuelve en qué provincia (o país vecino) cae un punto, usando los polígonos a resolución completa.
 * Si una estación costera queda justo fuera del polígono, se asigna a la provincia más cercana.
 */
function makeLocator(provinceGeo, countriesTopo) {
  const provinces = provinceGeo.features.map((f) => ({
    code: String(f.properties.cod_prov).padStart(2, '0'),
    feature: f,
    bounds: geoBounds(f),
    centroid: geoCentroid(f),
  }));
  const neighbours = feature(countriesTopo, countriesTopo.objects.countries).features.filter((f) => [250, 620, 20].includes(Number(f.id)));
  const inBox = ([lon, lat], [[x0, y0], [x1, y1]]) => lon >= x0 - 0.05 && lon <= x1 + 0.05 && lat >= y0 - 0.05 && lat <= y1 + 0.05;
  const memo = new Map();

  return (point) => {
    const key = point.join(',');
    if (memo.has(key)) return memo.get(key);
    let result;
    const hit = provinces.find((p) => inBox(point, p.bounds) && geoContains(p.feature, point));
    if (hit) result = { province: hit.code, ccaa: CCAA_BY_PROVINCE[hit.code] };
    else if (neighbours.some((c) => geoContains(c, point))) result = { province: null, ccaa: INTERNATIONAL };
    else {
      const near = provinces.reduce((a, b) => (geoDistance(point, a.centroid) < geoDistance(point, b.centroid) ? a : b));
      result = { province: near.code, ccaa: CCAA_BY_PROVINCE[near.code] };
    }
    memo.set(key, result);
    return result;
  };
}

// ---------- Calendario de servicio ----------

/** Fecha de hoy en Madrid (YYYYMMDD), para que el «hoy» de los datos sea el de España aunque se generen de madrugada. */
function madridToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts.replaceAll('-', '');
}

/**
 * Días (índice desde `base`) en que circula cada servicio, según calendar.txt y calendar_dates.txt
 * (altas y bajas por festivos). Devuelve Map service_id → Set de índices de día.
 */
function serviceCalendar(calendar, calendarDates, base, days) {
  const dayIndex = (s) => Math.round((parseYmd(s) - base) / 86400000);
  const removed = groupBy(calendarDates.filter((c) => c.exception_type === '2'), (c) => c.service_id);
  const added = groupBy(calendarDates.filter((c) => c.exception_type === '1'), (c) => c.service_id);
  const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const result = new Map();
  for (const c of calendar) {
    const set = new Set();
    const from = Math.max(0, dayIndex(c.start_date));
    const to = Math.min(days - 1, dayIndex(c.end_date));
    for (let i = from; i <= to; i++) {
      const date = new Date(base.getTime() + i * 86400000);
      if (c[WEEKDAYS[date.getUTCDay()]] === '1') set.add(i);
    }
    for (const r of removed.get(c.service_id) ?? []) set.delete(dayIndex(r.date));
    for (const a of added.get(c.service_id) ?? []) {
      const i = dayIndex(a.date);
      if (i >= 0 && i < days) set.add(i);
    }
    result.set(c.service_id, set);
  }
  // Último día que cubre el calendario (más allá no hay datos, no «sin servicio»).
  const lastDay = Math.min(days - 1, Math.max(-1, ...calendar.map((c) => dayIndex(c.end_date))));
  return { days: result, covered: lastDay + 1 };
}

/** Huecos sin trenes más largos que esto (la noche) cortan el horario de servicio en tramos. */
const SERVICE_GAP_MIN = 150;

/**
 * Horario de servicio de una línea para cada día: lista de tramos [inicio, fin] en minutos desde la medianoche
 * de ese día (pueden pasar de 1440 si un tren acaba de madrugada), o 0 si ese día no circula.
 * Los viajes se agrupan en tramos mientras no haya un hueco de más de SERVICE_GAP_MIN minutos sin ningún tren.
 */
function serviceWindows(spans, days) {
  const perDay = Array.from({ length: days }, () => []);
  for (const { serviceDays, start, end } of spans) {
    if (!serviceDays) continue;
    for (const d of serviceDays) perDay[d].push([start, end]);
  }
  return perDay.map((list) => {
    if (!list.length) return 0;
    list.sort((a, b) => a[0] - b[0]);
    const merged = [list[0].slice()];
    for (const [s, e] of list.slice(1)) {
      const last = merged.at(-1);
      if (s - last[1] <= SERVICE_GAP_MIN) last[1] = Math.max(last[1], e);
      else merged.push([s, e]);
    }
    return merged;
  });
}

// ---------- GTFS común ----------

function indexGtfs(gtfs) {
  const stops = new Map(gtfs['stops.txt'].map((s) => [s.stop_id, s]));
  const routes = new Map(gtfs['routes.txt'].map((r) => [r.route_id, r]));
  const timesByTrip = new Map();
  for (const [id, seq] of groupBy(gtfs['stop_times.txt'], (st) => st.trip_id)) {
    timesByTrip.set(
      id,
      seq.filter((s) => stops.has(s.stop_id)).sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence)),
    );
  }
  return { stops, routes, timesByTrip, trips: gtfs['trips.txt'] };
}

// ---------- Líneas de alta velocidad (mapa) ----------

/**
 * Líneas de alta velocidad del mapa. Cada línea guarda sus números de tren y, si el servidor ya lo ha
 * aprendido de RadarDeTrenes (.cache/routes.json), el trazado real de la vía (`track`).
 */
function buildHighSpeedLines({ stops, routes, timesByTrip, trips }, learnedTracks = {}, locate = null, serviceDays = new Map()) {
  const lines = new Map();
  for (const [routeId, routeTrips] of groupBy(trips, (t) => t.route_id)) {
    const type = routes.get(routeId)?.route_short_name;
    if (!MAP_TYPES.has(type)) continue;

    // Trayecto representativo: el viaje con más paradas.
    let best = [];
    for (const t of routeTrips) {
      const seq = timesByTrip.get(t.trip_id) ?? [];
      if (seq.length > best.length) best = seq;
    }
    const stopIds = best.map((s) => s.stop_id);
    if (stopIds.length < 2) continue;

    const [ca, cb] = [cityOf(stops.get(stopIds[0]).stop_name), cityOf(stops.get(stopIds.at(-1)).stop_name)];
    if (ca === cb) continue;
    const pair = [ca, cb].sort((x, y) => x.localeCompare(y, 'es'));
    const key = `av:${pair.join('|')}`;

    const line = lines.get(key) ?? {
      id: key,
      category: 'av',
      name: `${pair[0]} – ${pair[1]}`,
      types: new Set(),
      trips: 0,
      stopIds: [],
      trainNumbers: new Set(),
      spans: [],
    };
    line.types.add(type);
    for (const t of routeTrips) {
      const seq = timesByTrip.get(t.trip_id);
      if (!seq?.length) continue;
      line.spans.push({ serviceDays: serviceDays.get(t.service_id), start: toMinutes(seq[0].departure_time), end: toMinutes(seq.at(-1).arrival_time) });
    }
    for (const t of routeTrips) if (t.trip_short_name) line.trainNumbers.add(t.trip_short_name);
    line.trips += routeTrips.length;
    if (stopIds.length > line.stopIds.length) line.stopIds = stopIds;
    lines.set(key, line);
  }

  return [...lines.values()].map((l) => {
    const trains = [...l.trainNumbers].sort();
    // El trazado más largo entre los trenes de la línea es el que cubre el recorrido completo.
    const track = trains.map((n) => learnedTracks[n]).filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? null;

    // Comunidades por las que pasa (en orden de recorrido) y qué paradas tiene en cada una.
    const regions = [];
    for (const id of l.stopIds) {
      const st = stops.get(id);
      const where = locate?.([+st.stop_lon, +st.stop_lat]);
      if (!where) continue;
      let region = regions.find((r) => r.name === where.ccaa);
      if (!region) regions.push((region = { name: where.ccaa, stops: [] }));
      region.stops.push(st.stop_name);
    }
    return {
      id: l.id,
      category: l.category,
      name: l.name,
      types: [...l.types].sort(),
      trips: l.trips,
      trains,
      stops: l.stopIds.map((id) => stops.get(id).stop_name),
      coords: [l.stopIds.map((id) => [round(+stops.get(id).stop_lon), round(+stops.get(id).stop_lat)])],
      track,
      regions,
      service: serviceWindows(l.spans, DAYS),
    };
  });
}

// ---------- Horarios (buscador de billetes) ----------

function buildTimetable({ stops, routes, timesByTrip, trips }, gtfs) {
  const base = parseYmd(madridToday());
  // Días de circulación de cada servicio, dentro de la ventana [hoy, hoy + DAYS)
  const serviceDays = serviceCalendar(gtfs['calendar.txt'], gtfs['calendar_dates.txt'], base, DAYS).days;

  const stationIndex = new Map();
  const stations = [];
  const stationOf = (id) => {
    if (!stationIndex.has(id)) {
      const s = stops.get(id);
      stationIndex.set(id, stations.length);
      stations.push({ id, name: s.stop_name, city: cityOf(s.stop_name), lat: round(+s.stop_lat), lon: round(+s.stop_lon) });
    }
    return stationIndex.get(id);
  };

  const types = [];
  const typeOf = (t) => (types.includes(t) ? types.indexOf(t) : types.push(t) - 1);

  // Un mismo tren aparece en varios "trips" (uno por periodo de calendario): se fusionan.
  const trains = new Map();
  for (const t of trips) {
    const days = serviceDays.get(t.service_id);
    const seq = timesByTrip.get(t.trip_id);
    if (!days?.size || !seq || seq.length < 2) continue;
    const type = routes.get(t.route_id)?.route_short_name ?? 'Tren';
    const s = seq.map((st) => [stationOf(st.stop_id), toMinutes(st.arrival_time), toMinutes(st.departure_time)]);
    const key = `${t.trip_short_name}|${JSON.stringify(s)}`;
    const train = trains.get(key) ?? { n: t.trip_short_name, t: typeOf(type), s, days: new Set() };
    for (const d of days) train.days.add(d);
    trains.set(key, train);
  }

  // Días codificados como bits en hexadecimal: el carácter i guarda los días 4i..4i+3.
  const encode = (days) => {
    let hex = '';
    for (let i = 0; i < DAYS; i += 4) {
      let v = 0;
      for (let b = 0; b < 4; b++) if (days.has(i + b)) v |= 1 << b;
      hex += v.toString(16);
    }
    return hex;
  };

  return {
    base: base.toISOString().slice(0, 10),
    days: DAYS,
    types,
    stations,
    trains: [...trains.values()]
      .sort((a, b) => a.s[0][2] - b.s[0][2])
      .map(({ days, ...train }) => ({ ...train, d: encode(days) })),
  };
}

// ---------- Referencia para el tiempo real ----------

/**
 * El tiempo real de Renfe solo trae identificadores (nº de tren, id de estación).
 * Aquí se guarda lo necesario para mostrarlos con nombre: estaciones y trenes de larga distancia.
 */
function buildRealtimeReference({ stops, routes, timesByTrip, trips }, cerStops) {
  const names = {};
  for (const s of cerStops) names[s.stop_id] = s.stop_name;
  for (const [id, s] of stops) names[id] = s.stop_name;

  const trains = {};
  for (const t of trips) {
    const n = t.trip_short_name;
    const seq = timesByTrip.get(t.trip_id);
    if (!n || !seq?.length || trains[n]) continue;
    trains[n] = {
      type: routes.get(t.route_id)?.route_short_name ?? 'Tren',
      from: stops.get(seq[0].stop_id).stop_name,
      to: stops.get(seq.at(-1).stop_id).stop_name,
    };
  }
  return { stops: names, trains };
}

// ---------- Vías de Cercanías ----------

const NUCLEOS = {
  10: 'Madrid', 20: 'Asturias', 30: 'Sevilla', 31: 'Cádiz', 32: 'Málaga', 40: 'Valencia',
  41: 'Murcia/Alicante', 45: 'Cartagena', 46: 'Ferrol', 47: 'León', 50: 'Rodalies de Catalunya',
  51: 'Rodalies de Catalunya', 60: 'Bilbao', 61: 'San Sebastián', 62: 'Santander', 70: 'Zaragoza',
};

/**
 * Lee stop_times.txt de Cercanías (≈270 MB descomprimido) por trozos, sin cargarlo entero en memoria,
 * y guarda solo las paradas de los viajes que interesan.
 */
function readStopTimes(zipBuf, wantedTrips) {
  const out = new Map();
  const spans = new Map(); // trip_id → [primera salida, última llegada] en minutos, de TODOS los viajes
  const decoder = new TextDecoder();
  let rest = '';
  let cols = null;
  const handle = (line) => {
    if (!line.trim()) return;
    const f = line.split(',');
    if (!cols) {
      const header = f.map((h) => h.replace(/^﻿/, '').trim());
      cols = {
        trip: header.indexOf('trip_id'),
        stop: header.indexOf('stop_id'),
        seq: header.indexOf('stop_sequence'),
        arr: header.indexOf('arrival_time'),
        dep: header.indexOf('departure_time'),
      };
      return;
    }
    const trip = f[cols.trip].trim();
    const dep = toMinutes(f[cols.dep].trim());
    const arr = toMinutes(f[cols.arr].trim());
    const span = spans.get(trip);
    if (!span) spans.set(trip, [dep, arr]);
    else {
      if (dep < span[0]) span[0] = dep;
      if (arr > span[1]) span[1] = arr;
    }
    if (!wantedTrips.has(trip)) return;
    if (!out.has(trip)) out.set(trip, []);
    out.get(trip).push([f[cols.stop].trim(), Number(f[cols.seq])]);
  };

  const unzipper = new Unzip();
  unzipper.register(UnzipInflate);
  unzipper.onfile = (file) => {
    if (file.name !== 'stop_times.txt') return;
    file.ondata = (err, chunk, final) => {
      if (err) throw err;
      const lines = (rest + decoder.decode(chunk, { stream: !final })).split(/\r?\n/);
      rest = final ? '' : lines.pop();
      lines.forEach(handle);
    };
    file.start();
  };
  unzipper.push(new Uint8Array(zipBuf), true);
  for (const seq of out.values()) seq.sort((a, b) => a[1] - b[1]);
  return { sequences: out, spans };
}

/** "Principe Pio<relleno hasta 40>-Aeropuerto-T4" → ["Principe Pio", "Aeropuerto-T4"] */
function routeEnds(longName) {
  const parts = longName[40] === '-' ? [longName.slice(0, 40), longName.slice(41)] : longName.split(/\s+-/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Red de Cercanías y Rodalies desde el GTFS de Renfe: por cada línea (núcleo + código, p. ej. "C3 · Madrid")
 * su trazado real (shapes.txt), su color oficial (route_color), sus estaciones y las provincias que recorre.
 */
function buildCercaniasNetwork(gtfs, zipBuf, locate, serviceDays) {
  const shapes = new Map();
  for (const [id, pts] of groupBy(gtfs['shapes.txt'], (p) => p.shape_id)) {
    const coords = pts
      .sort((a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence))
      .map((p) => [+p.shape_pt_lon, +p.shape_pt_lat]);
    shapes.set(id, simplify(coords, 0.0004).map(([x, y]) => [round(x), round(y)]));
  }
  const routes = new Map(gtfs['routes.txt'].map((r) => [r.route_id, r]));
  const stops = new Map(gtfs['stops.txt'].map((s) => [s.stop_id, s]));

  // Un viaje de muestra por cada variante de recorrido (ruta + forma) basta para conocer sus paradas.
  const lines = new Map();
  const sampleTrips = new Set();
  for (const t of gtfs['trips.txt']) {
    const route = routes.get(t.route_id);
    const code = route?.route_short_name;
    if (!code || code === 'BUS') continue;
    const nucleoId = t.route_id.slice(0, 2);
    const id = `cer:${nucleoId}:${code}`;
    if (!lines.has(id)) {
      lines.set(id, { id, code, nucleoId, colors: new Map(), shapeIds: new Set(), variants: new Map(), routeIds: new Set(), trips: [] });
    }
    const line = lines.get(id);
    line.trips.push(t);
    line.routeIds.add(t.route_id);
    const color = route.route_color?.toUpperCase();
    if (color && color !== 'FFFFFF') line.colors.set(color, (line.colors.get(color) ?? 0) + 1);
    if (t.shape_id && shapes.has(t.shape_id)) line.shapeIds.add(t.shape_id);
    const variant = `${t.route_id}|${t.shape_id}`;
    if (!line.variants.has(variant)) {
      line.variants.set(variant, t.trip_id);
      sampleTrips.add(t.trip_id);
    }
  }

  const { sequences: stopTimes, spans: tripSpans } = readStopTimes(zipBuf, sampleTrips);

  return [...lines.values()]
    .map((line) => {
      // Estaciones: el recorrido más largo, más las de los ramales que no estén ya.
      const sequences = [...line.variants.values()].map((trip) => stopTimes.get(trip) ?? []).sort((a, b) => b.length - a.length);
      const seen = new Set();
      const stationIds = [];
      for (const seq of sequences) {
        for (const [sid] of seq) {
          if (stops.has(sid) && !seen.has(sid)) {
            seen.add(sid);
            stationIds.push(sid);
          }
        }
      }
      const stations = stationIds.map((sid) => {
        const st = stops.get(sid);
        return { name: st.stop_name, lat: round(+st.stop_lat), lon: round(+st.stop_lon) };
      });

      const provinceCodes = [...new Set(stations.map((st) => locate([st.lon, st.lat]).province).filter(Boolean))];
      const longest = sequences[0] ?? [];
      const ends = longest.length
        ? [stops.get(longest[0][0])?.stop_name, stops.get(longest.at(-1)[0])?.stop_name]
        : routeEnds(routes.get([...line.routeIds][0]).route_long_name);
      const color = [...line.colors.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const nucleo = NUCLEOS[line.nucleoId] ?? 'Cercanías';

      return {
        id: line.id,
        code: line.code,
        nucleo,
        name: `${line.code} · ${nucleo}`,
        color: color ? `#${color}` : null,
        from: ends[0] ?? null,
        to: ends[1] ?? null,
        provinces: provinceCodes,
        stations,
        coords: [...line.shapeIds].map((sid) => shapes.get(sid)).filter((c) => c.length > 1),
        service: serviceWindows(
          line.trips
            .filter((t) => tripSpans.has(t.trip_id))
            .map((t) => ({ serviceDays: serviceDays.get(t.service_id), start: tripSpans.get(t.trip_id)[0], end: tripSpans.get(t.trip_id)[1] })),
          DAYS,
        ),
      };
    })
    .filter((l) => l.coords.length)
    .sort((a, b) => a.nucleo.localeCompare(b.nucleo, 'es') || a.code.localeCompare(b.code, 'es', { numeric: true }));
}

// ---------- Mapa base ----------

function cleanRing(ring, tol, digits) {
  const s = simplify(ring, tol).map(([x, y]) => [round(x, digits), round(y, digits)]);
  return s.length >= 4 ? s : null;
}

function toMultiPolygon(geometry, tol, keepPolygon = () => true) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return {
    type: 'MultiPolygon',
    coordinates: polys
      .filter(keepPolygon)
      .map((p) => p.map((r) => cleanRing(r, tol, 3)).filter(Boolean))
      .filter((p) => p.length),
  };
}

function buildProvinces(geo, cercaniasLines = []) {
  const clean = (name) => name.split('/').pop().replace(' De ', ' de ').trim();
  const withNetwork = new Set(cercaniasLines.flatMap((l) => l.provinces));
  return {
    type: 'FeatureCollection',
    features: geo.features.map((f) => {
      const code = String(f.properties.cod_prov).padStart(2, '0');
      return {
        type: 'Feature',
        properties: { name: clean(f.properties.name), code, ccaa: CCAA_BY_PROVINCE[code], cercanias: withNetwork.has(code) },
        geometry: toMultiPolygon(f.geometry, 0.012),
      };
    }),
  };
}

/** Portugal, Francia y Andorra (solo su parte europea continental + Córcega). */
function buildCountries(topo) {
  const WANTED = { 620: 'Portugal', 250: 'Francia', 20: 'Andorra' };
  const inEurope = (poly) => {
    const [lon, lat] = poly[0][0];
    return lon > -10 && lon < 10 && lat > 36 && lat < 52;
  };
  const world = feature(topo, topo.objects.countries);
  return {
    type: 'FeatureCollection',
    features: world.features
      .filter((f) => WANTED[Number(f.id)])
      .map((f) => ({
        type: 'Feature',
        properties: { name: WANTED[Number(f.id)] },
        geometry: toMultiPolygon(f.geometry, 0.01, inEurope),
      })),
  };
}

// ---------- main ----------

await mkdir(CACHE, { recursive: true });
await mkdir(OUT, { recursive: true });
await mkdir(SERVER_OUT, { recursive: true });

const [ldZip, cerZip, provBuf, worldBuf] = await Promise.all([
  download(SOURCES.ld, 'renfe-ld.zip'),
  download(SOURCES.cer, 'renfe-cercanias.zip'),
  download(SOURCES.provinces, 'provinces.geojson'),
  download(SOURCES.world, 'countries-50m.json'),
]);

const gtfs = unzip(ldZip, ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'calendar.txt', 'calendar_dates.txt']);
const indexed = indexGtfs(gtfs);

const sources = [
  {
    name: 'Renfe Data · GTFS Alta Velocidad, Larga y Media Distancia',
    url: 'https://data.renfe.com/dataset/horarios-de-alta-velocidad-larga-distancia-y-media-distancia',
  },
  { name: 'RadarDeTrenes · tiempo real y trazados (datos de Renfe y ADIF)', url: 'https://radardetrenes.com' },
];
const provinceGeo = JSON.parse(provBuf.toString('utf8'));
const worldTopo = JSON.parse(worldBuf.toString('utf8'));
const locate = makeLocator(provinceGeo, worldTopo);

const serviceBase = parseYmd(madridToday());
const serviceBaseIso = serviceBase.toISOString().slice(0, 10);
const ldCalendar = serviceCalendar(gtfs['calendar.txt'], gtfs['calendar_dates.txt'], serviceBase, DAYS);

const learnedTracks = JSON.parse(await readFile(path.join(CACHE, 'routes.json'), 'utf8').catch(() => '{}'));
const network = {
  generatedAt: new Date().toISOString(),
  sources,
  // Horario de servicio: line.service[d] = tramos [[inicio, fin], …] del día serviceBase + d (o 0 si no circula).
  serviceBase: serviceBaseIso,
  serviceDays: ldCalendar.covered,
  lines: buildHighSpeedLines(indexed, learnedTracks, locate, ldCalendar.days),
};
const timetable = { generatedAt: network.generatedAt, sources, ...buildTimetable(indexed, gtfs) };

const cerGtfs = unzip(cerZip, ['stops.txt', 'routes.txt', 'trips.txt', 'shapes.txt', 'calendar.txt']);
const cerCalendar = serviceCalendar(cerGtfs['calendar.txt'], [], serviceBase, DAYS);
const cercanias = {
  generatedAt: network.generatedAt,
  source: { name: 'Renfe Data · GTFS Cercanías y Rodalies', url: 'https://data.renfe.com/dataset/horarios-cercanias' },
  serviceBase: serviceBaseIso,
  serviceDays: cerCalendar.covered,
  lines: buildCercaniasNetwork(cerGtfs, cerZip, locate, cerCalendar.days),
};
const provinces = buildProvinces(provinceGeo, cercanias.lines);
const countries = buildCountries(worldTopo);

await writeFile(path.join(OUT, 'network.json'), JSON.stringify(network));
await writeFile(path.join(OUT, 'timetable.json'), JSON.stringify(timetable));
await writeFile(path.join(OUT, 'provinces.json'), JSON.stringify(provinces));
await writeFile(path.join(OUT, 'countries.json'), JSON.stringify(countries));

await writeFile(path.join(OUT, 'cercanias.json'), JSON.stringify(cercanias));
console.log(
  `✔ Cercanías: ${cercanias.lines.length} líneas, ${cercanias.lines.reduce((n, l) => n + l.stations.length, 0)} estaciones, ` +
    `${provinces.features.filter((f) => f.properties.cercanias).length} provincias con red`,
);

const reference = buildRealtimeReference(indexed, cerGtfs['stops.txt']);
await writeFile(path.join(SERVER_OUT, 'reference.json'), JSON.stringify(reference));
console.log(`✔ Referencia tiempo real: ${Object.keys(reference.stops).length} estaciones, ${Object.keys(reference.trains).length} trenes`);

console.log(
  `✔ Mapa: ${network.lines.length} líneas AV (${network.lines.filter((l) => l.track).length} con trazado real) · Billetes: ${timetable.trains.length} trenes, ${timetable.stations.length} estaciones, ${DAYS} días desde ${timetable.base} · ${provinces.features.length} provincias · ${countries.features.length} países`,
);
