import { useEffect, useState } from 'react';

const getJson = (url) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  });

// Se descarga una sola vez: al volver a la sección «Mapa» se reutiliza.
let cache = null;
export function loadNetwork() {
  cache ??= Promise.all([getJson('/data/provinces.json'), getJson('/data/countries.json'), getJson('/data/network.json')]).then(
    ([provinces, countries, network]) => ({
      status: 'ready',
      provinces,
      countries,
      lines: network.lines.sort((a, b) => a.name.localeCompare(b.name, 'es')),
      meta: network,
    }),
  );
  cache.catch(() => (cache = null));
  return cache;
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
