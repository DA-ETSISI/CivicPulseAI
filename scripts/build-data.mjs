/**
 * Descarga los datos abiertos oficiales y genera los JSON ligeros que usa la web.
 *
 *   npm run data            (usa la caché de .cache/ si existe)
 *   npm run data -- --fresh (fuerza una descarga nueva)
 *
 * Fuentes:
 *  - Renfe Data (GTFS Alta Velocidad, Larga y Media Distancia): https://data.renfe.com/dataset/horarios-de-alta-velocidad-larga-distancia-y-media-distancia
 *  - Límites provinciales (derivados de IGN/CNIG):               https://github.com/codeforgermany/click_that_hood
 *  - Países vecinos (Natural Earth, vía world-atlas):            https://github.com/topojson/world-atlas
 *
 * Salida en public/data/:
 *  - network.json    líneas de alta velocidad para el mapa
 *  - timetable.json  horarios de todos los trenes AV/LD/MD para el buscador de billetes
 *  - provinces.json  provincias de España
 *  - countries.json  Portugal, Francia y Andorra
 */
import { unzipSync, strFromU8 } from 'fflate';
import { feature } from 'topojson-client';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SOURCES = {
  ld: 'https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip',
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

function buildHighSpeedLines({ stops, routes, timesByTrip, trips }) {
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

    const line = lines.get(key) ?? { id: key, category: 'av', name: `${pair[0]} – ${pair[1]}`, types: new Set(), trips: 0, stopIds: [] };
    line.types.add(type);
    line.trips += routeTrips.length;
    if (stopIds.length > line.stopIds.length) line.stopIds = stopIds;
    lines.set(key, line);
  }

  return [...lines.values()].map((l) => ({
    id: l.id,
    category: l.category,
    name: l.name,
    types: [...l.types].sort(),
    trips: l.trips,
    stops: l.stopIds.map((id) => stops.get(id).stop_name),
    coords: [l.stopIds.map((id) => [round(+stops.get(id).stop_lon), round(+stops.get(id).stop_lat)])],
  }));
}

// ---------- Horarios (buscador de billetes) ----------

function buildTimetable({ stops, routes, timesByTrip, trips }, gtfs) {
  const base = parseYmd(ymd(new Date()));
  const dayIndex = (s) => Math.round((parseYmd(s) - base) / 86400000);

  // Días de circulación de cada servicio, dentro de la ventana [hoy, hoy + DAYS)
  const removed = groupBy(gtfs['calendar_dates.txt'].filter((c) => c.exception_type === '2'), (c) => c.service_id);
  const added = groupBy(gtfs['calendar_dates.txt'].filter((c) => c.exception_type === '1'), (c) => c.service_id);
  const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const serviceDays = new Map();
  for (const c of gtfs['calendar.txt']) {
    const days = new Set();
    const from = Math.max(0, dayIndex(c.start_date));
    const to = Math.min(DAYS - 1, dayIndex(c.end_date));
    for (let i = from; i <= to; i++) {
      const date = new Date(base.getTime() + i * 86400000);
      if (c[WEEKDAYS[date.getUTCDay()]] === '1') days.add(i);
    }
    for (const r of removed.get(c.service_id) ?? []) days.delete(dayIndex(r.date));
    for (const a of added.get(c.service_id) ?? []) {
      const i = dayIndex(a.date);
      if (i >= 0 && i < DAYS) days.add(i);
    }
    serviceDays.set(c.service_id, days);
  }

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

function buildProvinces(geo) {
  const clean = (name) => name.split('/').pop().replace(' De ', ' de ').trim();
  return {
    type: 'FeatureCollection',
    features: geo.features.map((f) => ({
      type: 'Feature',
      properties: { name: clean(f.properties.name), code: f.properties.cod_prov },
      geometry: toMultiPolygon(f.geometry, 0.012),
    })),
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

const [ldZip, provBuf, worldBuf] = await Promise.all([
  download(SOURCES.ld, 'renfe-ld.zip'),
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
];
const network = { generatedAt: new Date().toISOString(), sources, lines: buildHighSpeedLines(indexed) };
const timetable = { generatedAt: network.generatedAt, sources, ...buildTimetable(indexed, gtfs) };
const provinces = buildProvinces(JSON.parse(provBuf.toString('utf8')));
const countries = buildCountries(JSON.parse(worldBuf.toString('utf8')));

await writeFile(path.join(OUT, 'network.json'), JSON.stringify(network));
await writeFile(path.join(OUT, 'timetable.json'), JSON.stringify(timetable));
await writeFile(path.join(OUT, 'provinces.json'), JSON.stringify(provinces));
await writeFile(path.join(OUT, 'countries.json'), JSON.stringify(countries));

console.log(
  `✔ Mapa: ${network.lines.length} líneas AV · Billetes: ${timetable.trains.length} trenes, ${timetable.stations.length} estaciones, ${DAYS} días desde ${timetable.base} · ${provinces.features.length} provincias · ${countries.features.length} países`,
);
