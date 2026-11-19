import { useEffect, useState } from 'react';

// Red de Cercanías generada con `npm run data` a partir del GTFS de Renfe Data.
// Solo se descarga la primera vez que se entra en una provincia (o al pasar el ratón por una).
let cache = null;
export function loadCercanias() {
  cache ??= fetch('/data/cercanias.json').then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
  cache.catch(() => (cache = null));
  return cache;
}

/** Líneas de Cercanías que tienen alguna estación en la provincia `code`. */
export function useProvinceCercanias(code) {
  const [state, setState] = useState({ status: 'idle', lines: [], source: null, base: null, covered: 0 });

  useEffect(() => {
    if (!code) {
      setState({ status: 'idle', lines: [], source: null, base: null, covered: 0 });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading' }));
    loadCercanias()
      .then((data) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          lines: data.lines.filter((l) => l.provinces.includes(code)),
          source: data.source,
          base: data.serviceBase,
          covered: data.serviceDays,
        });
      })
      .catch(() => !cancelled && setState({ status: 'error', lines: [], source: null, base: null, covered: 0 }));
    return () => {
      cancelled = true;
    };
  }, [code]);

  return state;
}
