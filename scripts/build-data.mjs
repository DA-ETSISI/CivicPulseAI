/**
 * Descarga los datos abiertos oficiales y genera los JSON ligeros que usa la web.
 *
 *   npm run data
 *
 * Fuentes:
 *  - Renfe Data (GTFS Alta Velocidad, Larga y Media Distancia): https://data.renfe.com/dataset/horarios-de-alta-velocidad-larga-distancia-y-media-distancia
 *  - Renfe Data (GTFS Cercanías y Rodalies):                     https://data.renfe.com/dataset/horarios-cercanias
 *  - Límites provinciales (derivados de IGN/CNIG):               https://github.com/codeforgermany/click_that_hood
 *
 * Salida: public/data/provinces.json y public/data/network.json
 */
import { unzipSync, strFromU8 } from 'fflate';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SOURCES = {
  ld: 'https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip',
  cer: 'https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip',
  provinces:
    'https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/spain-provinces.geojson',
};

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

// ---------- Alta Velocidad, Larga y Media Distancia ----------

const AV_TYPES = new Set(['AVE', 'AVANT', 'AVLO', 'AVE Euromed', 'AVANT EXP', 'Alvia', 'Euromed']);
const categoryOf = (type) => (AV_TYPES.has(type) ? 'av' : type === 'Regional' || type === 'MD' ? 'md' : 'ld');

function buildLongDistance(gtfs) {
  const stops = new Map(gtfs['stops.txt'].map((s) => [s.stop_id, s]));
  const routes = new Map(gtfs['routes.txt'].map((r) => [r.route_id, r]));
  const tripsByRoute = groupBy(gtfs['trips.txt'], (t) => t.route_id);
  const timesByTrip = groupBy(gtfs['stop_times.txt'], (st) => st.trip_id);

  const lines = new Map();
  for (const [routeId, trips] of tripsByRoute) {
    const route = routes.get(routeId);
    if (!route) continue;
    const type = route.route_short_name || 'Tren';
    const category = categoryOf(type);

    // Trayecto representativo: el viaje con más paradas.
    let best = [];
    for (const t of trips) {
      const seq = timesByTrip.get(t.trip_id) ?? [];
      if (seq.length > best.length) best = seq;
    }
    best = [...best].sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
    const stopIds = best.map((s) => s.stop_id).filter((id) => stops.has(id));
    if (stopIds.length < 2) continue;

    const a = stopIds[0], b = stopIds.at(-1);
    const [ca, cb] = [cityOf(stops.get(a).stop_name), cityOf(stops.get(b).stop_name)];
    if (ca === cb) continue; // circulares/internos sin interés en el mapa nacional
    const pair = [ca, cb].sort((x, y) => x.localeCompare(y, 'es'));
    const key = `${category}:${pair.join('|')}`;

    const line = lines.get(key) ?? {
      id: key,
      category,
      name: `${pair[0]} – ${pair[1]}`,
      types: new Set(),
      trips: 0,
      stopIds: [],
    };
    line.types.add(type);
    line.trips += trips.length;
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

// ---------- Cercanías y Rodalies ----------

const NUCLEOS = {
  10: 'Madrid', 20: 'Asturias', 30: 'Sevilla', 31: 'Cádiz', 32: 'Málaga', 40: 'Valencia',
  41: 'Murcia/Alicante', 45: 'Cartagena', 46: 'Ferrol', 47: 'León', 50: 'Rodalies de Catalunya',
  51: 'Rodalies de Catalunya', 60: 'Bilbao', 61: 'San Sebastián', 62: 'Santander', 70: 'Zaragoza',
};

function buildCercanias(gtfs) {
  const shapes = new Map();
  for (const [id, pts] of groupBy(gtfs['shapes.txt'], (p) => p.shape_id)) {
    const coords = pts
      .sort((a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence))
      .map((p) => [+p.shape_pt_lon, +p.shape_pt_lat]);
    shapes.set(id, simplify(coords, 0.0004).map(([x, y]) => [round(x), round(y)]));
  }
  const shapesByRoute = new Map();
  for (const t of gtfs['trips.txt']) {
    if (!t.shape_id) continue;
    if (!shapesByRoute.has(t.route_id)) shapesByRoute.set(t.route_id, new Map());
    const m = shapesByRoute.get(t.route_id);
    m.set(t.shape_id, (m.get(t.shape_id) ?? 0) + 1);
  }

  const lines = new Map();
  for (const r of gtfs['routes.txt']) {
    const short = r.route_short_name;
    if (!short || short === 'BUS') continue;
    const nucleoId = r.route_id.slice(0, 2);
    const nucleo = NUCLEOS[nucleoId] ?? `Núcleo ${nucleoId}`;
    const key = `cer:${nucleoId}:${short}`;
    const line = lines.get(key) ?? {
      id: key,
      category: 'cer',
      name: `${short} · ${nucleo}`,
      nucleo,
      types: [short],
      trips: 0,
      stops: [],
      shapeIds: new Set(),
    };
    // route_long_name viene en ancho fijo: "Origen<relleno hasta 40>-Destino"
    const raw = r.route_long_name;
    const ends = (raw[40] === '-' ? [raw.slice(0, 40), raw.slice(41)] : raw.split(/\s+-/))
      .map((s) => s.trim())
      .filter(Boolean);
    if (!line.stops.length && ends.length) line.stops = ends;
    for (const [sid, n] of shapesByRoute.get(r.route_id) ?? []) {
      line.shapeIds.add(sid);
      line.trips += n;
    }
    lines.set(key, line);
  }

  return [...lines.values()]
    .map(({ shapeIds, ...l }) => ({
      ...l,
      coords: [...shapeIds].map((s) => shapes.get(s)).filter((c) => c && c.length > 1),
    }))
    .filter((l) => l.coords.length);
}

// ---------- Provincias ----------

function buildProvinces(geo) {
  const clean = (name) =>
    name
      .split('/')
      .pop()
      .replace(' De ', ' de ')
      .trim();
  const ring = (r) => {
    const s = simplify(r, 0.012).map(([x, y]) => [round(x, 3), round(y, 3)]);
    return s.length >= 4 ? s : null;
  };
  return {
    type: 'FeatureCollection',
    features: geo.features.map((f) => {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      const coordinates = polys.map((p) => p.map(ring).filter(Boolean)).filter((p) => p.length);
      return {
        type: 'Feature',
        properties: { name: clean(f.properties.name), code: f.properties.cod_prov },
        geometry: { type: 'MultiPolygon', coordinates },
      };
    }),
  };
}

// ---------- main ----------

await mkdir(CACHE, { recursive: true });
await mkdir(OUT, { recursive: true });

const [ldZip, cerZip, provBuf] = await Promise.all([
  download(SOURCES.ld, 'renfe-ld.zip'),
  download(SOURCES.cer, 'renfe-cercanias.zip'),
  download(SOURCES.provinces, 'provinces.geojson'),
]);

const ld = buildLongDistance(unzip(ldZip, ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt']));
const cer = buildCercanias(unzip(cerZip, ['routes.txt', 'trips.txt', 'shapes.txt']));
const provinces = buildProvinces(JSON.parse(provBuf.toString('utf8')));

const network = {
  generatedAt: new Date().toISOString(),
  sources: [
    { name: 'Renfe Data · GTFS Alta Velocidad, Larga y Media Distancia', url: 'https://data.renfe.com/dataset/horarios-de-alta-velocidad-larga-distancia-y-media-distancia' },
    { name: 'Renfe Data · GTFS Cercanías y Rodalies', url: 'https://data.renfe.com/dataset/horarios-cercanias' },
  ],
  lines: [...ld, ...cer],
};

await writeFile(path.join(OUT, 'network.json'), JSON.stringify(network));
await writeFile(path.join(OUT, 'provinces.json'), JSON.stringify(provinces));

const count = (c) => network.lines.filter((l) => l.category === c).length;
console.log(
  `✔ ${network.lines.length} líneas (AV ${count('av')}, LD ${count('ld')}, MD ${count('md')}, Cercanías ${count('cer')}) · ${provinces.features.length} provincias`,
);
