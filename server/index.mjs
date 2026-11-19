/**
 * Servidor de incidencias en tiempo real.
 *
 *   npm run server   (lo arranca también `npm run dev`)
 *
 * Cada 20 s descarga las posiciones GPS de los trenes que publica Renfe (GTFS-Realtime)
 * y calcula el estado de cada tren:
 *
 *   STOPPED_AT     → «Parado» en una estación
 *   INCOMING_AT    → «En camino», llegando a la siguiente estación
 *   IN_TRANSIT_TO  → «En movimiento» entre estaciones
 *
 * Regla de retraso: si un tren figura «En movimiento» pero su posición GPS no ha cambiado
 * (menos de STILL_METERS) durante al menos DELAY_AFTER_MIN minutos, pasa a «Retraso».
 *
 * Además se añaden los datos oficiales de Renfe: el retraso en minutos de cada tren
 * (trip updates), los trenes cancelados y los avisos de servicio (alerts).
 *
 * Fuente: Renfe Data · GTFS-RT (https://data.renfe.com/)
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 3001);
const POLL_MS = 20_000;
const STILL_METERS = 40;
const DELAY_AFTER_MIN = 3;
/** Si una fuente lleva más de este tiempo sin actualizarse, no se marcan retrasos (no hay pruebas). */
const STALE_FEED_MS = 3 * 60_000;
/** A partir de cuántos minutos de retraso oficial se destaca un tren. */
const OFFICIAL_DELAY_MIN = 5;
/** Un tren que deja de aparecer en la fuente se olvida pasado este tiempo. */
const FORGET_MS = 10 * 60_000;

const FEEDS = [
  { kind: 'ld', label: 'Alta velocidad, larga y media distancia', url: 'https://gtfsrt.renfe.com/vehicle_positions_LD.json' },
  { kind: 'cer', label: 'Cercanías', url: 'https://gtfsrt.renfe.com/vehicle_positions.json' },
];

const NUCLEOS = {
  10: 'Madrid', 20: 'Asturias', 30: 'Sevilla', 31: 'Cádiz', 32: 'Málaga', 40: 'Valencia',
  41: 'Murcia/Alicante', 45: 'Cartagena', 46: 'Ferrol', 47: 'León', 50: 'Rodalies de Catalunya',
  51: 'Rodalies de Catalunya', 60: 'Bilbao', 61: 'San Sebastián', 62: 'Santander', 70: 'Zaragoza',
};

const TRIP_FEEDS = [
  { kind: 'ld', url: 'https://gtfsrt.renfe.com/trip_updates_LD.json' },
  { kind: 'cer', url: 'https://gtfsrt.renfe.com/trip_updates.json' },
];
const ALERTS_URL = 'https://gtfsrt.renfe.com/alerts.json';

const STATUS_BY_RAW = { STOPPED_AT: 'stopped', INCOMING_AT: 'incoming', IN_TRANSIT_TO: 'moving' };

const reference = JSON.parse(
  await readFile(path.join(import.meta.dirname, 'data', 'reference.json'), 'utf8').catch(() => '{"stops":{},"trains":{}}'),
);

/** Estado interno por tren: última posición y desde cuándo no se mueve. */
const vehicles = new Map();
/** Datos oficiales: retraso por viaje (tripId → segundos), viajes cancelados y avisos. */
let officialDelays = new Map();
let canceled = [];
let alerts = [];
const official = { ok: false, lastRefresh: null, error: null };
const feedState = Object.fromEntries(
  FEEDS.map((f) => [f.kind, { kind: f.kind, label: f.label, ok: false, lastPoll: null, lastRefresh: null, version: null, error: null }]),
);

function meters(a, b) {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/** Datos legibles del tren a partir de los identificadores del tiempo real. */
function describe(kind, v) {
  const tripId = v.trip?.tripId ?? '';
  const label = v.vehicle?.label ?? v.vehicle?.id ?? tripId;
  if (kind === 'ld') {
    const number = tripId.slice(0, 5);
    const info = reference.trains[number];
    return { number, label: `${info?.type ?? 'Tren'} ${number}`, type: info?.type ?? 'Larga distancia', origin: info?.from ?? null, destination: info?.to ?? null };
  }
  const line = label.split('-')[0];
  const nucleo = NUCLEOS[tripId.slice(0, 2)] ?? 'Cercanías';
  return { number: v.vehicle?.id ?? '', label: `${line} · ${nucleo}`, type: 'Cercanías', line, nucleo, origin: null, destination: null };
}

async function pollFeed(feed) {
  const state = feedState[feed.kind];
  const now = Date.now();
  state.lastPoll = new Date(now).toISOString();
  try {
    const res = await fetch(feed.url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const version = res.headers.get('last-modified') ?? json.header?.timestamp;
    const fresh = version !== state.version;
    state.ok = true;
    state.error = null;
    if (!fresh) return; // la fuente aún no ha publicado datos nuevos: no hay nada que comparar
    state.version = version;
    state.lastRefresh = new Date(now).toISOString();

    for (const entity of json.entity ?? []) {
      const v = entity.vehicle;
      if (!v?.position) continue;
      const key = `${feed.kind}:${entity.id}`;
      const pos = { lat: v.position.latitude, lon: v.position.longitude };
      const raw = v.currentStatus ?? 'IN_TRANSIT_TO';
      const prev = vehicles.get(key);

      // Se cuenta desde cuándo está quieto. Si se ha movido o acaba de cambiar de estado
      // (p. ej. sale de una estación), el contador vuelve a empezar.
      const moved = !prev || meters(prev.pos, pos) > STILL_METERS || raw !== prev.raw;
      const stillSince = moved ? now : prev.stillSince;

      vehicles.set(key, {
        key,
        kind: feed.kind,
        tripId: v.trip?.tripId ?? null,
        pos,
        raw,
        stillSince,
        lastSeen: now,
        stopId: v.stopId ?? null,
        info: describe(feed.kind, v),
      });
    }
  } catch (err) {
    state.ok = false;
    state.error = err.message;
  }
}

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** "10T0007C3" → "C3 · Madrid"; rutas de larga distancia → "Larga distancia". */
function routeLabel(routeId) {
  const m = /^(\d{2})T\d{4}(.+)$/.exec(routeId);
  if (!m) return 'Larga distancia';
  return `${m[2]} · ${NUCLEOS[m[1]] ?? 'Cercanías'}`;
}

async function pollOfficial() {
  try {
    const [tripFeeds, alertFeed] = await Promise.all([Promise.all(TRIP_FEEDS.map((f) => getJson(f.url))), getJson(ALERTS_URL)]);

    const delays = new Map();
    const cancel = [];
    tripFeeds.forEach((feed, i) => {
      for (const e of feed.entity ?? []) {
        const tu = e.tripUpdate;
        const tripId = tu?.trip?.tripId;
        if (!tripId) continue;
        if (tu.trip.scheduleRelationship === 'CANCELED') {
          cancel.push({ kind: TRIP_FEEDS[i].kind, tripId });
          continue;
        }
        const delay = tu.delay ?? tu.stopTimeUpdate?.find((u) => u.arrival?.delay != null)?.arrival.delay;
        if (delay != null) delays.set(tripId, Number(delay));
      }
    });

    const nowSec = Date.now() / 1000;
    const list = [];
    for (const e of alertFeed.entity ?? []) {
      const a = e.alert;
      const period = a.activePeriod?.[0] ?? {};
      if (period.end && Number(period.end) < nowSec) continue;
      const raw = a.descriptionText?.translation?.find((t) => t.language === 'es')?.text ?? a.descriptionText?.translation?.[0]?.text;
      if (!raw) continue;
      const entities = a.informedEntity ?? [];
      list.push({
        id: e.id,
        // Los avisos empiezan con etiquetas tipo "#MadC3": se quitan del texto.
        text: raw.replace(/^(#\S+\s*)+/, '').trim(),
        lines: [...new Set(entities.filter((x) => x.routeId).map((x) => routeLabel(x.routeId)))],
        stops: [...new Set(entities.filter((x) => x.stopId).map((x) => reference.stops[x.stopId] ?? x.stopId))],
        start: period.start ? new Date(Number(period.start) * 1000).toISOString() : null,
        end: period.end ? new Date(Number(period.end) * 1000).toISOString() : null,
      });
    }
    list.sort((x, y) => (y.start ?? '').localeCompare(x.start ?? ''));

    officialDelays = delays;
    canceled = cancel;
    alerts = list;
    official.ok = true;
    official.error = null;
    official.lastRefresh = new Date().toISOString();
  } catch (err) {
    official.ok = false;
    official.error = err.message;
  }
}

async function pollAll() {
  await Promise.all([...FEEDS.map(pollFeed), pollOfficial()]);
  const now = Date.now();
  for (const [key, v] of vehicles) if (now - v.lastSeen > FORGET_MS) vehicles.delete(key);
}

function snapshot() {
  const now = Date.now();
  const trains = [];
  for (const v of vehicles.values()) {
    const feed = feedState[v.kind];
    const feedFresh = feed.lastRefresh && now - Date.parse(feed.lastRefresh) < STALE_FEED_MS;
    const stillMinutes = Math.floor((now - v.stillSince) / 60_000);
    let status = STATUS_BY_RAW[v.raw] ?? 'moving';
    if (status === 'moving' && feedFresh && stillMinutes >= DELAY_AFTER_MIN) status = 'delay';

    const delaySec = v.tripId ? officialDelays.get(v.tripId) : undefined;

    trains.push({
      id: v.key,
      kind: v.kind,
      ...v.info,
      lat: v.pos.lat,
      lon: v.pos.lon,
      rawStatus: v.raw,
      status,
      stopId: v.stopId,
      stopName: v.stopId ? (reference.stops[v.stopId] ?? `Estación ${v.stopId}`) : null,
      stillMinutes,
      officialDelayMin: delaySec == null ? null : Math.round(delaySec / 60),
      lastSeen: new Date(v.lastSeen).toISOString(),
    });
  }

  const order = { delay: 0, moving: 1, incoming: 2, stopped: 3 };
  trains.sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      (b.officialDelayMin ?? 0) - (a.officialDelayMin ?? 0) ||
      b.stillMinutes - a.stillMinutes ||
      a.label.localeCompare(b.label),
  );

  const counts = { total: trains.length, moving: 0, incoming: 0, stopped: 0, delay: 0, officialDelayed: 0, canceled: canceled.length };
  for (const t of trains) {
    counts[t.status]++;
    if (t.officialDelayMin >= OFFICIAL_DELAY_MIN) counts.officialDelayed++;
  }

  return {
    generatedAt: new Date(now).toISOString(),
    pollSeconds: POLL_MS / 1000,
    rules: { stillMeters: STILL_METERS, delayAfterMin: DELAY_AFTER_MIN, officialDelayMin: OFFICIAL_DELAY_MIN },
    feeds: Object.values(feedState),
    official,
    alerts,
    counts,
    trains,
  };
}

// ---------- HTTP ----------

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (code, body) => {
    res.writeHead(code, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    });
    res.end(JSON.stringify(body));
  };

  if (req.method === 'GET' && url.pathname === '/api/incidencias') return send(200, snapshot());
  if (req.method === 'GET' && url.pathname === '/api/health') return send(200, { ok: true, feeds: Object.values(feedState) });
  send(404, { error: 'No encontrado' });
});

await pollAll();
setInterval(pollAll, POLL_MS);
server.listen(PORT, () => {
  console.log(`🚆 Incidencias en tiempo real en http://localhost:${PORT}/api/incidencias (${vehicles.size} trenes)`);
});
