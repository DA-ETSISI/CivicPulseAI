/**
 * Lectura del QR de un billete, todo en el dispositivo.
 *
 * PRIVACIDAD
 * - El contenido del QR solo vive dentro de `parseTicketText`: de ahí sale un objeto con lo mínimo
 *   para el itinerario (número de tren, fecha, estaciones y, si viene, coche y plaza). Todo lo demás
 *   —nombre, DNI/pasaporte, email, teléfono, localizador, precio…— no se copia a ningún sitio y se descarta.
 * - No se registra nada en consola ni se envía a ningún servidor.
 * - El formato del QR de Renfe no está documentado públicamente y puede ir cifrado o firmado. No se intenta
 *   saltar ninguna protección: solo se entienden QR con datos legibles; si no, se pide la entrada manual.
 */
import { findStationOption } from './timetable.js';
import { normTrain } from './myTicket.js';

// ---------- Decodificar el QR de una imagen o de un fotograma de vídeo ----------

let detectorPromise = null;

/** BarcodeDetector nativo si el navegador lo tiene con soporte de QR; si no, null. */
function nativeDetector() {
  detectorPromise ??= (async () => {
    if (!('BarcodeDetector' in window)) return null;
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      return formats.includes('qr_code') ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
    } catch {
      return null;
    }
  })();
  return detectorPromise;
}

const canvas = () => document.createElement('canvas');

/**
 * Lee un QR de un vídeo, imagen o ImageBitmap. Devuelve el texto o null.
 * Usa BarcodeDetector cuando existe y, si no, jsQR (que solo se descarga en ese momento).
 */
export async function decodeQr(source) {
  const native = await nativeDetector();
  if (native) {
    try {
      const codes = await native.detect(source);
      if (codes[0]?.rawValue) return codes[0].rawValue;
    } catch {
      /* se prueba con jsQR */
    }
  }
  const w = source.videoWidth || source.naturalWidth || source.width;
  const h = source.videoHeight || source.naturalHeight || source.height;
  if (!w || !h) return null;
  const scale = Math.min(1, 1200 / Math.max(w, h));
  const c = canvas();
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, c.width, c.height);
  const { default: jsQR } = await import('jsqr');
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const result = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
  ctx.clearRect(0, 0, c.width, c.height);
  return result?.data ?? null;
}

// ---------- Extraer solo los datos del viaje ----------

/** Claves que se aceptan (en cualquier mayúscula/minúscula). Cualquier otra se ignora. */
const KEYS = {
  train: ['tren', 'train', 'numtren', 'n_tren', 'ntren', 'num_tren', 'trainnumber', 'train_number'],
  date: ['fecha', 'date', 'fec', 'fecha_viaje', 'traveldate'],
  from: ['origen', 'from', 'orig', 'estacion_origen', 'origin'],
  to: ['destino', 'to', 'dest', 'estacion_destino', 'destination'],
  car: ['coche', 'car', 'vagon', 'coach'],
  seat: ['plaza', 'seat', 'asiento'],
};
const kindOf = (key) => Object.entries(KEYS).find(([, names]) => names.includes(key.toLowerCase().replace(/[^a-z_]/g, '')))?.[0];

/** Pares clave → valor de un QR con formato URL, JSON o «CLAVE:valor;CLAVE:valor». */
function readPairs(text) {
  const pairs = [];
  try {
    const url = new URL(text);
    for (const [k, v] of url.searchParams) pairs.push([k, v]);
    if (pairs.length) return pairs;
  } catch {
    /* no es una URL */
  }
  try {
    const json = JSON.parse(text);
    const walk = (obj) => {
      for (const [k, v] of Object.entries(obj ?? {})) {
        if (v && typeof v === 'object') walk(v);
        else pairs.push([k, String(v)]);
      }
    };
    if (json && typeof json === 'object') walk(json);
    if (pairs.length) return pairs;
  } catch {
    /* no es JSON */
  }
  for (const part of text.split(/[;|\n&]/)) {
    const m = /^\s*([A-Za-z_]+)\s*[:=]\s*(.+?)\s*$/.exec(part);
    if (m) pairs.push([m[1], m[2]]);
  }
  return pairs;
}

/** «20/11/2026», «2026-11-20» o «20261120» → «2026-11-20». */
function readDate(v) {
  let m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(v.trim());
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v.trim());
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/** Código de estación de Renfe (5 cifras) o nombre → índices de estación de los horarios. */
function readStation(tt, v) {
  const code = v.replace(/\D/g, '');
  if (code.length >= 4) {
    const i = tt.stations.findIndex((s) => s.id === code.padStart(5, '0'));
    if (i >= 0) return [i];
  }
  return findStationOption(tt, v)?.ids ?? null;
}

/**
 * Devuelve { date, legs: [{ number, from, to }], car, seat } con SOLO los datos del viaje, o null si el
 * QR no tiene datos legibles (por ejemplo, porque va cifrado). El texto original no se guarda.
 */
export function parseTicketText(tt, text) {
  if (typeof text !== 'string' || !text) return null;
  const found = { train: [], date: null, from: [], to: [], car: null, seat: null };
  for (const [key, value] of readPairs(text)) {
    const kind = kindOf(key);
    if (!kind || !value) continue; // nombre, DNI, email, localizador, precio… no se leen
    if (kind === 'train') found.train.push(...value.split(/[,\s/]+/).filter((x) => /^\d{3,5}$/.test(x)));
    else if (kind === 'date') found.date ??= readDate(value);
    else if (kind === 'from') found.from.push(readStation(tt, value));
    else if (kind === 'to') found.to.push(readStation(tt, value));
    else if (kind === 'car') found.car ??= value.replace(/\D/g, '').slice(0, 3) || null;
    else if (kind === 'seat') found.seat ??= value.replace(/[^\dA-Za-z]/g, '').slice(0, 4) || null;
  }
  if (!found.train.length || !found.date) return null;
  return {
    date: found.date,
    legs: found.train.map((n, i) => ({ number: normTrain(n), from: found.from[i] ?? null, to: found.to[i] ?? null })),
    car: found.car,
    seat: found.seat,
  };
}
