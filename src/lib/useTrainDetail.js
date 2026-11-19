import { useEffect, useState } from 'react';

const REFRESH_MS = 20_000;

/**
 * Seguimiento de un tren: posición, trazado real, paradas con horario y evolución del retraso.
 * Se actualiza cada 20 s mientras el tren está seleccionado.
 */
export function useTrainDetail(id) {
  const [state, setState] = useState({ id: null, status: 'idle', data: null });

  useEffect(() => {
    if (!id) {
      setState({ id: null, status: 'idle', data: null });
      return undefined;
    }
    let cancelled = false;
    setState((s) => (s.id === id ? s : { id, status: 'loading', data: null }));

    const load = async () => {
      try {
        const res = await fetch(`/api/trains/${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setState({ id, status: 'ready', data });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, id, status: s.data ? 'ready' : 'error' }));
      }
    };
    load();
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  return state.id === id ? state : { id, status: id ? 'loading' : 'idle', data: null };
}
