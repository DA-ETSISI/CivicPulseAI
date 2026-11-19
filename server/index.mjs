/**
 * Servidor de datos ferroviarios en tiempo real.
 *
 *   npm run server   (lo arranca también `npm run dev`)
 *
 * Fuente principal: RadarDeTrenes (https://radardetrenes.com/openapi.json), una API pública y gratuita
 * que reúne los datos abiertos de Renfe (GTFS-RT, flota, avisos) y de ADIF (tableros de estaciones).
 *
 * Qué hace:
 *  1. Cada 20 s descarga la posición de todos los trenes de Renfe (/fleet).
 *  2. Deduce el estado de cada tren a partir de su GPS y de las estaciones:
 *       «Parado» (a menos de 400 m de una estación), «En camino» (a menos de 1,5 km de la siguiente)
 *       o «En movimiento» (entre estaciones).
 *  3. Regla de retraso: si un tren figura «En movimiento» y su GPS no se desplaza más de STILL_METERS
 *     durante DELAY_AFTER_MIN minutos, pasa a «Retraso».
 *  4. Aprende el trazado real de los trenes de larga distancia (/trains/{id}/route) para dibujarlo en los mapas.
 *  5. Sirve todo a la web en /api/* con caché, para no depender de que la API externa responda siempre.
 */
import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 3001);
const RDT = 'https://radardetrenes.com/api/v1';
const ROOT = path.resolve(import.meta.dirname, '..');
const ROUTES_FILE = path.join(ROOT, '.cache', 'routes.json');

const POLL_MS = 20_000;
const STILL_METERS = 40;
const DELAY_AFTER_MIN = 3;
const AT_STATION_METERS = 400;
const INCOMING_METERS = 1500;
/** A partir de cuántos minutos de retraso oficial se destaca un tren. */
const OFFICIAL_DELAY_MIN = 5;
/** Si la flota lleva más de este tiempo sin actualizarse, no se marcan retrasos (no hay pruebas). */
const STALE_FEED_MS = 3 * 60_000;
const FORGET_MS = 10 * 60_000;

// ---------- Llamadas a la API con caché ----------

const cache = new Map();

async function fetchJson(url, timeout = 12_000) {
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url.replace(RDT, '')}`);
  return res.json();
}

/**
 * Devuelve la respuesta en caché si tiene menos de `ttl` ms. Si hay que pedirla y la API falla,
 * devuelve la última copia buena (aunque sea antigua) para que la web siga funcionando.
 */
async function cached(apiPath, ttl, { retries = 1, timeout } = {}) {
  const hit = cache.get(apiPath);
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  if (hit?.pending) return hit.pending;

  const pending = (async () => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const data = await fetchJson(`${RDT}${apiPath}`, timeout);
        cache.set(apiPath, { data, at: Date.now() });
        return data;
      } catch (err) {
        lastError = err;
      }
    }
    if (hit) {
      cache.set(apiPath, { ...hit, pending: null });
      return hit.data;
    }
    cache.delete(apiPath);
    throw lastError;
  })();
  cache.set(apiPath, { ...(hit ?? {}), pending });
  return pending;
}

// ---------- Utilidades ----------

function meters(a, b) {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/** Simplificación Douglas–Peucker para que los trazados pesen poco. */
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

const round = (n) => Math.round(n * 1e5) / 1e5;

// ---------- Estaciones ----------

let stations = new Map();
async function loadStations() {
  try {
    const data = await cached('/stations', 24 * 3600_000, { retries: 2, timeout: 20_000 });
    stations = new Map(
      (data.stations ?? []).map((s) => [String(s.code).padStart(5, '0'), { name: s.name, lat: s.latitude, lon: s.longitude }]),
    );
  } catch {
    /* se reintentará en el siguiente ciclo */
  }
}
const stationAt = (code) => (code ? stations.get(String(code).padStart(5, '0')) : undefined);

// ---------- Flota y regla de retraso ----------

const vehicles = new Map();
const feed = { ok: false, lastPoll: null, updatedAt: null, error: null };

/** Estado deducido del GPS: parado en estación, llegando a la siguiente o entre estaciones. */
function deduceStatus(t, pos) {
  const here = [t.currentStationCode, t.previousStationCode].map(stationAt).filter(Boolean);
  if (here.some((s) => meters(s, pos) <= AT_STATION_METERS)) return 'stopped';
  const next = stationAt(t.nextStationCode);
  if (next && meters(next, pos) <= AT_STATION_METERS) return 'stopped';
  if (next && meters(next, pos) <= INCOMING_METERS) return 'incoming';
  return 'moving';
}

async function pollFleet() {
  const now = Date.now();
  feed.lastPoll = new Date(now).toISOString();
  try {
    const data = await fetchJson(`${RDT}/fleet`, 15_000);
    const fresh = data.updatedAt !== feed.updatedAt;
    feed.ok = true;
    feed.error = null;
    if (!fresh) return;
    feed.updatedAt = data.updatedAt;

    for (const t of data.trains ?? []) {
      if (t.latitude == null) continue;
      const pos = { lat: t.latitude, lon: t.longitude };
      const status = deduceStatus(t, pos);
      const prev = vehicles.get(t.id);
      // Se cuenta desde cuándo está quieto; si se mueve o cambia de estado, el contador vuelve a empezar.
      const moved = !prev || meters(prev.pos, pos) > STILL_METERS || status !== prev.baseStatus || t.speedKmh > 0;
      vehicles.set(t.id, { raw: t, pos, baseStatus: status, stillSince: moved ? now : prev.stillSince, lastSeen: now });
      if (t.type === 'long_distance') queueRoute(t.id, t.trainCode);
    }
  } catch (err) {
    feed.ok = false;
    feed.error = err.message;
  }
  for (const [id, v] of vehicles) if (now - v.lastSeen > FORGET_MS) vehicles.delete(id);
}

function toTrain(v, now) {
  const t = v.raw;
  const feedFresh = feed.updatedAt && now - Date.parse(feed.updatedAt) < STALE_FEED_MS;
  const stillMinutes = Math.floor((now - v.stillSince) / 60_000);
  let status = v.baseStatus;
  if (status === 'moving' && feedFresh && !t.stale && stillMinutes >= DELAY_AFTER_MIN) status = 'delay';

  const isCer = t.type === 'commuter';
  const product = t.productName ?? (isCer ? 'Cercanías' : 'Tren');
  const nucleo = isCer ? (CLUSTERS[t.clusterCode] ?? 'Cercanías') : null;
  const current = stationAt(t.currentStationCode);
  return {
    id: t.id,
    kind: isCer ? 'cer' : 'ld',
    number: t.trainCode,
    label: isCer ? `${t.line ?? 'Cercanías'} · ${nucleo}` : `${product} ${t.trainCode}`,
    type: product,
    color: t.productColor ?? null,
    line: t.line ?? null,
    nucleo,
    origin: t.originName ?? null,
    destination: t.destinationName ?? null,
    lat: t.latitude,
    lon: t.longitude,
    status,
    stopName: status === 'stopped' ? (current?.name ?? t.nextStationName) : t.nextStationName,
    nextStation: t.nextStationName ?? null,
    nextArrival: t.nextStationArrival ?? null,
    platform: t.nextPlatform ?? t.platform ?? null,
    speedKmh: t.speedKmh ?? null,
    officialDelayMin: t.delayMinutes ?? null,
    stale: Boolean(t.stale),
    stillMinutes,
    positionAt: t.timestamp ?? null,
  };
}

const CLUSTERS = {
  10: 'Madrid', 20: 'Asturias', 30: 'Sevilla', 31: 'Cádiz', 32: 'Málaga', 40: 'Valencia',
  41: 'Murcia/Alicante', 45: 'Cartagena', 46: 'Ferrol', 47: 'León', 50: 'Rodalies de Catalunya',
  51: 'Rodalies de Catalunya', 60: 'Bilbao', 61: 'San Sebastián', 62: 'Santander', 70: 'Zaragoza',
};

// ---------- Avisos (incidencias, obras, cancelaciones) ----------

const KIND_LABEL = { incidencia: 'Incidencia', obras: 'Obras', cancelacion: 'Cancelación', otros: 'Aviso' };

async function getAlerts() {
  try {
    const data = await cached('/alerts?scope=network', 60_000, { timeout: 15_000 });
    return (data.items ?? []).map((a) => ({
      id: a.id,
      kind: a.kind,
      kindLabel: KIND_LABEL[a.kind] ?? 'Aviso',
      text: a.text,
      lines: [
        ...(a.lines ?? []).map((l) => l.label),
        ...(a.train ? [`${a.train.product} ${a.train.number}`] : []),
      ],
      networks: (a.networks ?? []).map((n) => n.name),
      stops: (a.stations ?? []).map((s) => s.label),
      start: a.activeFrom ?? null,
    }));
  } catch {
    return [];
  }
}

// ---------- Trazados reales de larga distancia ----------

/** trainCode → [[lon, lat], …] aprendido de /trains/{id}/route mientras el tren circula. */
let routes = {};
const routeQueue = [];
const routeTried = new Map();

async function loadRoutes() {
  try {
    routes = JSON.parse(await readFile(ROUTES_FILE, 'utf8'));
  } catch {
    routes = {};
  }
}

let saveTimer;
function saveRoutesSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await mkdir(path.dirname(ROUTES_FILE), { recursive: true });
    await writeFile(ROUTES_FILE, JSON.stringify(routes));
  }, 1_000);
}

function queueRoute(id, code) {
  if (routes[code] || routeQueue.some((q) => q.code === code)) return;
  const tried = routeTried.get(code);
  if (tried && Date.now() - tried < 30 * 60_000) return;
  routeQueue.push({ id, code });
}

function toLine(geometry) {
  const pts = (geometry ?? []).map((p) => [p.longitude, p.latitude]).filter(([x, y]) => x != null && y != null);
  return simplify(pts, 0.0008).map(([x, y]) => [round(x), round(y)]);
}

// Se pide un trazado cada 3 s para no saturar la API externa.
setInterval(async () => {
  const next = routeQueue.shift();
  if (!next) return;
  routeTried.set(next.code, Date.now());
  try {
    const data = await fetchJson(`${RDT}/trains/${encodeURIComponent(next.id)}/route`, 15_000);
    const line = toLine(data.geometry);
    if (line.length > 1) {
      routes[next.code] = line;
      saveRoutesSoon();
    }
  } catch {
    /* se reintentará más tarde */
  }
}, 3_000);

// ---------- Detalle de un tren (seguimiento) ----------

async function trainDetail(id) {
  const v = vehicles.get(id);
  const train = v ? toTrain(v, Date.now()) : null;
  const isLd = id.startsWith('ld-');
  const safe = (p) => p.catch(() => null);

  const [route, stops, history] = await Promise.all([
    isLd ? safe(cached(`/trains/${encodeURIComponent(id)}/route`, 10 * 60_000, { timeout: 15_000 })) : null,
    safe(cached(`/trains/${encodeURIComponent(id)}/stops`, 60_000, { timeout: 15_000 })),
    isLd ? safe(cached(`/trains/${encodeURIComponent(id)}/delay-history`, 60_000, { timeout: 15_000 })) : null,
  ]);

  const geometry = route?.geometry ? toLine(route.geometry) : (train && routes[train.number]) || null;
  if (route?.geometry && train) {
    routes[train.number] = geometry;
    saveRoutesSoon();
  }

  const stopList = (stops?.detail?.stops ?? []).map((s) => ({
    code: s.stationCode,
    name: s.stationName,
    arrival: s.arrivalTime ? new Date(s.arrivalTime).toISOString() : null,
    departure: s.departureTime ? new Date(s.departureTime).toISOString() : null,
    lat: stationAt(s.stationCode)?.lat ?? null,
    lon: stationAt(s.stationCode)?.lon ?? null,
  }));
  const routeStops = (route?.stops ?? []).map((s) => ({ code: s.stationCode, name: s.stationName, time: s.time, lat: s.latitude, lon: s.longitude }));

  return {
    train,
    geometry,
    stops: stopList.length ? stopList : routeStops.map((s) => ({ code: s.code, name: s.name, scheduled: s.time, lat: s.lat, lon: s.lon })),
    delayHistory: history ?? null,
  };
}

// ---------- Cercanías: vías con su trazado ----------

async function getLines() {
  try {
    const data = await cached('/lines', 3600_000, { retries: 2, timeout: 20_000 });
    return data.lines.map((l) => ({
      id: `cer:${l.clusterCode}:${l.code}`,
      name: `${l.code} · ${l.clusterName}`,
      color: l.color,
      coords: (l.geometry?.type === 'MultiLineString' ? l.geometry.coordinates : [l.geometry?.coordinates ?? []])
        .map((part) => simplify(part, 0.0003).map(([x, y]) => [round(x), round(y)]))
        .filter((part) => part.length > 1),
    }));
  } catch {
    // Copia de reserva generada con `npm run data` a partir del GTFS de Renfe.
    const file = JSON.parse(await readFile(path.join(ROOT, 'public', 'data', 'cercanias.json'), 'utf8'));
    return file.lines;
  }
}

// ---------- Trenes concretos (para Billetes) ----------

async function trainsByCode(codes) {
  const now = Date.now();
  const live = {};
  for (const v of vehicles.values()) if (codes.includes(v.raw.trainCode)) live[v.raw.trainCode] = toTrain(v, now);

  let stats = {};
  try {
    const data = await cached(`/stats/trains?codes=${[...codes].sort().join(',')}`, 30 * 60_000, { retries: 1, timeout: 15_000 });
    const entries = Array.isArray(data.trains) ? data.trains : Object.values(data.trains ?? {});
    for (const s of entries) {
      if (!s?.totalTrips) continue;
      stats[s.trainCode] = {
        window: s.window ?? data.window,
        trips: s.totalTrips,
        onTimePercent: s.onTimePercent ?? null,
        avgDelay: s.avgDelay ?? null,
        maxDelay: s.maxDelay ?? null,
      };
    }
  } catch {
    stats = {};
  }
  return { live, stats };
}

// ---------- Instantánea para la página de Incidencias ----------

async function snapshot() {
  const now = Date.now();
  const trains = [...vehicles.values()].map((v) => toTrain(v, now));
  const order = { delay: 0, moving: 1, incoming: 2, stopped: 3 };
  trains.sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      (b.officialDelayMin ?? 0) - (a.officialDelayMin ?? 0) ||
      b.stillMinutes - a.stillMinutes ||
      a.label.localeCompare(b.label),
  );

  const alerts = await getAlerts();
  const counts = {
    total: trains.length, moving: 0, incoming: 0, stopped: 0, delay: 0, officialDelayed: 0,
    canceled: alerts.filter((a) => a.kind === 'cancelacion').length,
  };
  for (const t of trains) {
    counts[t.status]++;
    if (t.officialDelayMin >= OFFICIAL_DELAY_MIN) counts.officialDelayed++;
  }

  return {
    generatedAt: new Date(now).toISOString(),
    pollSeconds: POLL_MS / 1000,
    source: { name: 'RadarDeTrenes (datos de Renfe y ADIF)', url: 'https://radardetrenes.com', ...feed },
    rules: { stillMeters: STILL_METERS, delayAfterMin: DELAY_AFTER_MIN, officialDelayMin: OFFICIAL_DELAY_MIN },
    counts,
    alerts,
    trains,
  };
}

// ---------- HTTP ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (code, body) => {
    res.writeHead(code, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end(JSON.stringify(body));
  };

  try {
    if (req.method !== 'GET') return send(405, { error: 'Método no permitido' });
    const p = url.pathname;
    if (p === '/api/incidencias') return send(200, await snapshot());
    if (p === '/api/lines') return send(200, { lines: await getLines() });
    if (p === '/api/geometry') return send(200, { routes });
    if (p === '/api/trains') {
      const codes = (url.searchParams.get('codes') ?? '').split(',').map((c) => c.trim()).filter(Boolean).slice(0, 40);
      return send(200, await trainsByCode(codes));
    }
    const m = /^\/api\/trains\/([^/]+)$/.exec(p);
    if (m) return send(200, await trainDetail(decodeURIComponent(m[1])));
    if (p === '/api/health') return send(200, { ok: true, feed, trains: vehicles.size, routes: Object.keys(routes).length });
    send(404, { error: 'No encontrado' });
  } catch (err) {
    send(502, { error: err.message });
  }
});

await Promise.all([loadRoutes(), loadStations()]);
await pollFleet();
setInterval(pollFleet, POLL_MS);
setInterval(() => stations.size || loadStations(), 60_000);
server.listen(PORT, () => {
  console.log(`🚆 Datos en tiempo real en http://localhost:${PORT}/api (${vehicles.size} trenes, ${stations.size} estaciones)`);
});
