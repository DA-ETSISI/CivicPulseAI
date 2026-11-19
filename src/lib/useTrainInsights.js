import { useEffect, useMemo, useState } from 'react';

const CHUNK = 40; // la API admite hasta 40 números de tren por consulta

/**
 * Para los trenes de una búsqueda de billetes: si están circulando ahora (con su retraso)
 * y su puntualidad de los últimos 30 días, según RadarDeTrenes. Si no hay datos, no muestra nada.
 */
export function useTrainInsights(numbers) {
  const key = useMemo(() => [...new Set(numbers)].sort().join(','), [numbers]);
  const [insights, setInsights] = useState({ live: {}, stats: {} });

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    const codes = key.split(',');
    const chunks = [];
    for (let i = 0; i < codes.length; i += CHUNK) chunks.push(codes.slice(i, i + CHUNK));

    Promise.all(
      chunks.map((c) =>
        fetch(`/api/trains?codes=${c.join(',')}`)
          .then((r) => (r.ok ? r.json() : { live: {}, stats: {} }))
          .catch(() => ({ live: {}, stats: {} })),
      ),
    ).then((parts) => {
      if (cancelled) return;
      setInsights({
        live: Object.assign({}, ...parts.map((p) => p.live)),
        stats: Object.assign({}, ...parts.map((p) => p.stats)),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return insights;
}
