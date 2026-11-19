import { useEffect, useState } from 'react';

const getJson = (url) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  });

// Se descarga una sola vez: al volver a la sección «Mapa» se reutiliza.
let cache = null;
export function loadNetwork() {
  cache ??= Promise.all([
    getJson('/data/provinces.json'),
    getJson('/data/countries.json'),
    getJson('/data/network.json'),
    loadLearnedTracks(),
  ]).then(([provinces, countries, network, learned]) => ({
    status: 'ready',
    provinces,
    countries,
    lines: withTracks(network.lines, learned).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    meta: network,
  }));
  cache.catch(() => (cache = null));
  return cache;
}

// Vías de Cercanías: solo las usa el mapa de incidencias, así que se descargan aparte.
// Vienen de RadarDeTrenes a través de nuestro servidor; si no responde, se usa la copia generada con `npm run data`.
let cercaniasCache = null;
export function loadCercaniasTracks() {
  cercaniasCache ??= getJson('/api/lines')
    .catch(() => getJson('/data/cercanias.json'))
    .then((d) => d.lines);
  cercaniasCache.catch(() => (cercaniasCache = null));
  return cercaniasCache;
}

// Trazados reales que el servidor ha aprendido de RadarDeTrenes mientras circulan los trenes.
let learnedCache = null;
function loadLearnedTracks() {
  learnedCache ??= getJson('/api/geometry')
    .then((d) => d.routes ?? {})
    .catch(() => ({}));
  return learnedCache;
}

/**
 * Añade a cada línea el trazado real de la vía si se conoce (guardado en network.json o aprendido
 * por el servidor). `stopCoords` conserva las estaciones para dibujar las paradas.
 */
function withTracks(lines, learned) {
  return lines.map((line) => {
    const fromServer = (line.trains ?? [])
      .map((n) => learned[n])
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0];
    const track = line.track ?? fromServer ?? null;
    return { ...line, stopCoords: line.coords[0], coords: track ? [track] : line.coords, realTrack: Boolean(track) };
  });
}

/** Provincias, países vecinos y líneas de alta velocidad (generados con `npm run data`). */
export function useNetworkData() {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadNetwork()
      .then((data) => !cancelled && setState(data))
      .catch((error) => !cancelled && setState({ status: 'error', error }));
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
