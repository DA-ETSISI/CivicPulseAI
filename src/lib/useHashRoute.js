import { useEffect, useState } from 'react';

/** Router mínimo basado en el hash de la URL (#/mapa, #/billetes). */
export function useHashRoute(fallback) {
  const read = () => window.location.hash.replace(/^#\/?/, '') || fallback;
  const [route, setRoute] = useState(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
