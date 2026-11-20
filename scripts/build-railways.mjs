/**
 * Genera la red ferroviaria de España para el mapa de la portada a partir de OpenStreetMap.
 *
 *   node scripts/build-railways.mjs            (usa la caché .cache/osm-railways.json si existe)
 *   node scripts/build-railways.mjs --fresh    (fuerza una descarga nueva desde Overpass)
 *
 * Fuente: OpenStreetMap (© colaboradores de OpenStreetMap, licencia ODbL), vía la API Overpass.
 * Se usan solo vías con trenes de viajeros: las que forman parte de una ruta `route=train` o están marcadas
 * como de viajeros o mixtas (ancho ibérico, estándar y métrico),
 * sin vías de servicio ni tramos marcados como solo mercancías.
 *
 * Salida en public/data/:
 *  - railways-es.geojson  MultiLineString con toda la red (solo visual)
 *  - lineas-es.geojson    FeatureCollection, una línea por nombre (`properties.n`), para la interacción
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.cache', 'osm-railways-pasajeros.json');
const OUT = path.join(ROOT, 'public', 'data');
// Solo vías por las que pasa algún tren de viajeros: las que forman parte de una ruta `route=train`
// (AVE, Larga y Media Distancia, Regionales, Cercanías, FGC…). Se quitan las de solo mercancías.
const QUERY =
  '[out:json][timeout:600];area["ISO3166-1"="ES"][admin_level=2]->.es;' +
  'relation["route"="train"](area.es)->.r;' +
  '(way(r.r)["railway"~"^(rail|narrow_gauge)$"];' +
  'way["railway"~"^(rail|narrow_gauge)$"]["railway:traffic_mode"~"^(passenger|mixed)$"](area.es);' +
  'way["railway"~"^(rail|narrow_gauge)$"]["passenger"~"^(yes|regional|suburban|national|international|urban)$"](area.es);)->.w;' +
  'way.w["service"!~"."]["railway:traffic_mode"!="freight"]["passenger"!="no"];out body geom qt;';

/** Tolerancias de simplificación (grados): la red de fondo puede ser más tosca que las líneas. */
const TOL_NET = 0.006;
const TOL_LINE = 0.008;
/** Líneas más cortas que esto (en grados aprox.) no merecen tooltip propio. */
const MIN_LINE_LEN = 0.15;

async function loadOsm() {
  if (existsSync(CACHE) && !process.argv.includes('--fresh')) return JSON.parse(await readFile(CACHE, 'utf8'));
  console.log('Descargando vías de OpenStreetMap (Overpass)…');
  // El servidor principal a veces está saturado (502/504): se prueban servidores espejo.
  const SERVERS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let text = null;
  for (const url of SERVERS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': 'rail-map-builder/1.0 (hackathon project)',
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: 'data=' + encodeURIComponent(QUERY),
        signal: AbortSignal.timeout(600_000),
      });
      if (!res.ok) throw new Error(`respondió ${res.status}`);
      text = await res.text();
      const remark = JSON.parse(text).remark;
      if (remark) throw new Error(`respuesta incompleta: ${remark}`);
      break;
    } catch (err) {
      console.log(`  ${new URL(url).host}: ${err.message}`);
      text = null;
    }
  }
  if (!text) throw new Error('Ningún servidor Overpass ha respondido');
  await mkdir(path.dirname(CACHE), { recursive: true });
  await writeFile(CACHE, text);
  return JSON.parse(text);
}

const key = ([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`;

/** Une tramos que comparten extremo en cadenas lo más largas posible (como `linemerge`). */
function mergeLines(lines) {
  const ends = new Map();
  const add = (k, i) => (ends.get(k) ?? ends.set(k, []).get(k)).push(i);
  lines.forEach((l, i) => {
    add(key(l[0]), i);
    add(key(l[l.length - 1]), i);
  });
  const used = new Uint8Array(lines.length);
  const take = (k) => {
    const list = ends.get(k) ?? [];
    for (const i of list) if (!used[i]) return i;
    return -1;
  };
  const out = [];
  for (let s = 0; s < lines.length; s++) {
    if (used[s]) continue;
    used[s] = 1;
    let chain = [...lines[s]];
    for (const atEnd of [true, false]) {
      for (;;) {
        const tip = atEnd ? chain[chain.length - 1] : chain[0];
        const i = take(key(tip));
        if (i < 0) break;
        used[i] = 1;
        let l = lines[i];
        if (atEnd) {
          if (key(l[0]) !== key(tip)) l = [...l].reverse();
          chain = chain.concat(l.slice(1));
        } else {
          if (key(l[l.length - 1]) !== key(tip)) l = [...l].reverse();
          chain = l.slice(0, -1).concat(chain);
        }
      }
    }
    out.push(chain);
  }
  return out;
}

/** Simplificación Douglas–Peucker (corrige la longitud por la latitud para no deformar). */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const kx = Math.cos((40 * Math.PI) / 180);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = (bx - ax) * kx, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let max = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const px = (pts[i][0] - ax) * kx, py = pts[i][1] - ay;
      const t = len2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
      const ex = px - t * dx, ey = py - t * dy;
      const d = ex * ex + ey * ey;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol * tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const round = (l) => l.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
const length = (l) => l.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0), 0);

/** Fusiona, simplifica y descarta restos de 2 puntos iguales tras redondear. */
function clean(lines, tol) {
  return mergeLines(lines)
    .map((l) => round(simplify(l, tol)))
    .map((l) => l.filter((p, i) => !i || p[0] !== l[i - 1][0] || p[1] !== l[i - 1][1]))
    .filter((l) => l.length > 1);
}

const osm = await loadOsm();
const ways = osm.elements.filter((e) => e.type === 'way' && e.geometry?.length > 1);
const coordsOf = (w) => w.geometry.map((g) => [g.lon, g.lat]);
console.log(`${ways.length} tramos de vía`);

// 1) Red completa (solo visual).
const network = clean(ways.map(coordsOf), TOL_NET);
const railways = { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: network } };

// 2) Líneas con nombre (para hover y clic). Se prefiere el nombre en castellano si existe.
const groups = new Map();
for (const w of ways) {
  const n = (w.tags['name:es'] || w.tags.name || '').trim();
  if (!n) continue;
  (groups.get(n) ?? groups.set(n, []).get(n)).push(coordsOf(w));
}
const features = [];
for (const [n, lines] of groups) {
  const parts = clean(lines, TOL_LINE);
  if (parts.reduce((s, l) => s + length(l), 0) < MIN_LINE_LEN) continue;
  features.push({ type: 'Feature', properties: { n }, geometry: { type: 'MultiLineString', coordinates: parts } });
}
const lineas = { type: 'FeatureCollection', features };

await mkdir(OUT, { recursive: true });
const write = async (file, data) => {
  const text = JSON.stringify(data);
  await writeFile(path.join(OUT, file), text);
  console.log(`${file}: ${(text.length / 1024).toFixed(0)} KB`);
};
await write('railways-es.geojson', railways);
await write('lineas-es.geojson', lineas);
console.log(`${features.length} líneas con nombre`);
