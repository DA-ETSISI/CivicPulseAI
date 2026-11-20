import { useEffect, useState } from 'react';

// Red ferroviaria de España (OpenStreetMap), generada con `node scripts/build-railways.mjs`.
// Se descarga una sola vez y se comparte entre todos los mapas que la usen.
let cache = null;
function loadRailways() {
  const get = (url) =>
    fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
  cache ??= get('/data/railways-es.geojson').then((network) => ({ network }));
  cache.catch(() => (cache = null));
  return cache;
}

/** `{ network }` cuando ya están descargados; `null` mientras tanto (o si fallan: el mapa sigue sin ellos). */
export function useRailways() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    loadRailways()
      .then((d) => !cancelled && setData(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}
