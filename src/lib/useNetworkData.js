import { useEffect, useState } from 'react';
import { CATEGORIES } from './categories.js';
import { lineColor } from './colors.js';

const ORDER = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, i]));

// Se descarga una sola vez: al volver a la pestaña «Mapa» se reutiliza.
let cache = null;
function loadNetwork() {
  cache ??= Promise.all([
    fetch('/data/provinces.json').then((r) => r.json()),
    fetch('/data/network.json').then((r) => r.json()),
  ]).then(([provinces, network]) => {
    const lines = network.lines
      .sort((a, b) => ORDER[a.category] - ORDER[b.category] || a.name.localeCompare(b.name, 'es'))
      .map((line, i) => ({ ...line, color: lineColor(i) }));
    return { status: 'ready', provinces, lines, meta: network };
  });
  cache.catch(() => (cache = null));
  return cache;
}

/** Carga provincias y líneas (generadas con `npm run data`) y asigna un color a cada línea. */
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
