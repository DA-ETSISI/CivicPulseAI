/**
 * Ajusta los mapas a la silueta exacta de las provincias (public/data/provinces.json):
 *  - Portugal, Francia y Andorra rellenan el hueco hasta la frontera española y se recortan contra ella,
 *    para que no queden huecos ni solapes (vienen de otra fuente, Natural Earth, menos detallada).
 *  - La red ferroviaria (railways-es / lineas-es) se recorta a la península: se corta justo en la
 *    frontera y se quitan las vías de Baleares, Canarias, Ceuta y Melilla.
 *
 *   node scripts/fit-borders.mjs public/data 6     (6 = km de margen para cerrar huecos)
 *
 * Ejecutar DESPUÉS de `npm run data` y de `node scripts/build-railways.mjs`, que sobrescriben esos archivos.
 * Necesita: npm i -D polygon-clipping@0.15.7 @turf/buffer@7.2.0
 */
import fs from 'node:fs';
import path from 'node:path';
import pc from 'polygon-clipping';
import buffer from '@turf/buffer';

const DIR = process.argv[2];
const KM = +(process.argv[3] || 6);
const rd = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const wr = (f, d) => { fs.writeFileSync(path.join(DIR, f), JSON.stringify(d)); console.log(f, Math.round(fs.statSync(path.join(DIR, f)).size / 1024), 'KB'); };

const provinces = rd('provinces.json');
const countries = rd('countries.json');
const NOT_MAINLAND = new Set(['07', '35', '38', '51', '52']); // Baleares, Canarias, Ceuta, Melilla
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);

const spainAll = pc.union(...provinces.features.filter((f) => !['35', '38', '51', '52'].includes(f.properties.code)).map((f) => polysOf(f.geometry)));
const mainland = pc.union(...provinces.features.filter((f) => !NOT_MAINLAND.has(f.properties.code)).map((f) => polysOf(f.geometry)));
const buf = (mp, km) => polysOf(buffer({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: mp } }, km, { units: 'kilometers', steps: 4 }).geometry);
// d3-geo espera los anillos exteriores en sentido horario (al revés que polygon-clipping).
const r3 = (mp) => mp.map((poly) => poly.map((ring) => [...ring].reverse().map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000])));

// --- 1) Países: rellenan el hueco hasta España y se recortan contra ella (Andorra antes que Francia).
const order = ['Andorra', 'Francia', 'Portugal'];
const bS = buf(mainland, KM);
let taken = spainAll;
const fixed = {};
for (const name of order) {
  const f = countries.features.find((c) => c.properties.name === name);
  const N = polysOf(f.geometry);
  const fill = pc.intersection(bS, buf(N, KM));
  const out = pc.difference(pc.union(N, fill), taken);
  fixed[name] = r3(out);
  taken = pc.union(taken, out);
}
countries.features = countries.features.map((f) => ({ ...f, geometry: { type: 'MultiPolygon', coordinates: fixed[f.properties.name] ?? polysOf(f.geometry) } }));
wr('countries.json', countries);

// --- 2) Vías: solo península, cortadas exactamente en la frontera.
const rings = mainland.flatMap((poly) => poly);
const edges = [];
for (const ring of rings) for (let i = 1; i < ring.length; i++) edges.push([ring[i - 1], ring[i]]);
const inside = ([x, y]) => {
  let c = false;
  for (const [[ax, ay], [bx, by]] of edges) if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) c = !c;
  return c;
};
function cross(a, b) { // primer punto donde a→b corta el contorno
  let best = null, bt = 2;
  for (const [p, q] of edges) {
    const d = (b[0] - a[0]) * (q[1] - p[1]) - (b[1] - a[1]) * (q[0] - p[0]);
    if (!d) continue;
    const t = ((p[0] - a[0]) * (q[1] - p[1]) - (p[1] - a[1]) * (q[0] - p[0])) / d;
    const u = ((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / d;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < bt) { bt = t; best = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]; }
  }
  return best && best.map((v) => Math.round(v * 1000) / 1000);
}
function clip(lines) {
  const out = [];
  for (const l of lines) {
    let cur = [];
    let prevIn = inside(l[0]);
    if (prevIn) cur.push(l[0]);
    for (let i = 1; i < l.length; i++) {
      const a = l[i - 1], b = l[i], bIn = inside(b);
      if (prevIn && bIn) cur.push(b);
      else if (prevIn && !bIn) { const x = cross(a, b); if (x) cur.push(x); if (cur.length > 1) out.push(cur); cur = []; }
      else if (!prevIn && bIn) { const x = cross(b, a); cur = x ? [x, b] : [b]; }
      prevIn = bIn;
    }
    if (cur.length > 1) out.push(cur);
  }
  return out;
}
const net = rd('railways-es.geojson');
const before = net.geometry.coordinates.length;
net.geometry.coordinates = clip(net.geometry.coordinates);
wr('railways-es.geojson', net);
console.log('red: tramos', before, '→', net.geometry.coordinates.length);

const lin = rd('lineas-es.geojson');
const n0 = lin.features.length;
lin.features = lin.features
  .map((f) => ({ ...f, geometry: { type: 'MultiLineString', coordinates: clip(f.geometry.coordinates) } }))
  .filter((f) => f.geometry.coordinates.length);
wr('lineas-es.geojson', lin);
console.log('líneas', n0, '→', lin.features.length);
