import { useEffect, useRef, useState } from 'react';

/**
 * `true` mientras la sección ocupa la franja central de la pantalla, `false` cuando se va.
 * Sirve para que las secciones de la portada aparezcan al llegar y desaparezcan al irse
 * (con la clase `.reveal` / `.is-visible`), en los dos sentidos.
 *
 * `band`: alto de la franja central, en % de la ventana (30 → del 35% al 65%).
 */
export function useInView(band = 30) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const edge = `-${(100 - band) / 2}%`;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: `${edge} 0px ${edge} 0px`,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [band]);

  return [ref, visible];
}
