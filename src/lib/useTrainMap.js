import { useCallback, useEffect, useRef, useState } from 'react';

const REFRESH_MS = 20_000;
const TIMEOUT_MS = 10_000;

/** Comprueba que la respuesta del servidor tiene la forma esperada antes de usarla. */
function isValidSnapshot(data) {
  return data && Array.isArray(data.trains) && typeof data.total === 'number' && data.facets;
}

/**
 * Posición en directo de todos los trenes (GET /api/trenes, servido por server/index.mjs).
 * Se actualiza cada 20 s mientras la pestaña está visible.
 *
 * - Cada petición cancela la anterior, así una respuesta lenta nunca pisa a una más nueva.
 * - Si el servidor tarda más de 10 s se corta la petición.
 * - Si falla una actualización se conservan los últimos datos buenos.
 */
export function useTrainMap() {
  const [state, setState] = useState({ status: 'loading', data: null, fetchedAt: null });
  const controllerRef = useRef(null);

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch('/api/trenes', { cache: 'no-store', signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!isValidSnapshot(data)) throw new Error('Respuesta con formato inesperado');
      setState({ status: 'ready', data, fetchedAt: Date.now() });
    } catch {
      // Petición sustituida por otra más nueva (o componente desmontado): no hay nada que hacer.
      if (controllerRef.current !== controller) return;
      setState((s) => ({ ...s, status: s.data ? 'ready' : 'error' }));
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => document.visibilityState === 'visible' && refresh(), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [refresh]);

  return { ...state, refresh };
}

/** «hace 12 s», actualizado cada segundo. */
export function useAgo(timestamp) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!timestamp) return '';
  const s = Math.max(0, Math.round((now - timestamp) / 1000));
  return s < 60 ? `hace ${s} s` : `hace ${Math.floor(s / 60)} min`;
}
