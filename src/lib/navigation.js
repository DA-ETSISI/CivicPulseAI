import { useEffect, useState } from 'react';

const readRoute = () => window.location.hash.replace(/^#\/?/, '') || 'inicio';

/** Cambia de sección. Funciona aunque se pulse dos veces la misma opción del menú. */
export function navigate(id) {
  const hash = `#/${id}`;
  if (window.location.hash !== hash) window.history.pushState(null, '', hash);
  window.dispatchEvent(new Event('app:navigate'));
}

/** Ruta actual (#/inicio, #/mapa, #/billetes, #/incidencias, #/rutas) + un contador que cambia en cada navegación. */
export function useRoute() {
  const [state, setState] = useState(() => ({ route: readRoute(), nonce: 0 }));

  useEffect(() => {
    const update = () => setState((s) => ({ route: readRoute(), nonce: s.nonce + 1 }));
    window.addEventListener('app:navigate', update);
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener('app:navigate', update);
      window.removeEventListener('popstate', update);
    };
  }, []);

  return state;
}

// ---------- Desplazamiento animado ----------

let frame = 0;
const cancel = () => cancelAnimationFrame(frame);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Desplaza la ventana hasta `y` con una curva suave. Si el usuario usa la rueda, se detiene. */
export function animateScrollTo(y) {
  cancel();
  const start = window.scrollY;
  const delta = y - start;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || Math.abs(delta) < 2) {
    window.scrollTo(0, y);
    return;
  }
  const duration = Math.min(1300, 550 + Math.abs(delta) * 0.35);
  const t0 = performance.now();
  window.addEventListener('wheel', cancel, { once: true, passive: true });
  window.addEventListener('touchstart', cancel, { once: true, passive: true });
  const step = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, start + delta * easeInOutCubic(t));
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
}

/**
 * Baja (o sube) hasta la sección con ese id, dejando sitio para la cabecera fija.
 * `gap`: espacio extra por encima de la sección (0 = pegada a la cabecera).
 */
export function scrollToSection(id, gap = 16) {
  const el = document.getElementById(id);
  if (!el) return;
  const header = document.querySelector('.header')?.offsetHeight ?? 64;
  animateScrollTo(Math.max(0, el.getBoundingClientRect().top + window.scrollY - header - gap));
}
