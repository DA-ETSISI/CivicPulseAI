import { useCallback, useEffect, useState } from 'react';

const REFRESH_MS = 20_000;

/** Estados posibles de un tren (los calcula el servidor a partir del GPS de Renfe). */
export const STATUSES = [
  { id: 'delay', label: 'Retraso', hint: 'Figura en movimiento pero su GPS no se mueve' },
  { id: 'moving', label: 'En movimiento', hint: 'Circulando entre dos estaciones' },
  { id: 'incoming', label: 'En camino', hint: 'Llegando a la siguiente estación' },
  { id: 'stopped', label: 'Parado', hint: 'Detenido en una estación' },
];
export const STATUS_BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

/** Consulta /api/incidencias cada 20 s mientras la pestaña está visible. */
export function useLiveTrains() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null, fetchedAt: null });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/incidencias', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setState({ status: 'ready', data, error: null, fetchedAt: Date.now() });
    } catch (error) {
      setState((s) => ({ ...s, status: s.data ? 'ready' : 'error', error }));
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
    };
  }, [refresh]);

  return { ...state, refresh };
}
