import { useCallback, useEffect, useRef, useState } from 'react';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import { NORTH_SLACK, WIDTH } from './mapGeometry.js';

const MAX_ZOOM = 14;

/** Curva de vuelo: arranca y frena con suavidad, como una cámara. */
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Zoom con rueda / pellizco y movimientos de cámara:
 * - zoomBy / reset para los botones,
 * - focus(x, y, k) para centrar un punto (seguir un tren),
 * - fitBounds(bounds) para encuadrar una ruta o una provincia con un vuelo suave.
 * Con «reducir movimiento» activado no hay vuelos: el mapa salta y hace un fundido corto.
 *
 * Opciones:
 *  - `northSlack`: margen extra hacia el norte (para llegar a Lyon con zoom).
 *  - `wheelNeedsModifier`: la rueda solo hace zoom con Ctrl (o ⌘) pulsado, para que el mapa no «atrape»
 *    el scroll de la página. Llama a `onWheelBlocked` cuando se intenta sin Ctrl.
 */
export function useMapZoom(svgRef, height, { northSlack = NORTH_SLACK, wheelNeedsModifier = false, onWheelBlocked } = {}) {
  const zoomRef = useRef(null);
  const blockedRef = useRef(onWheelBlocked);
  blockedRef.current = onWheelBlocked;
  const [transform, setTransform] = useState(zoomIdentity);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const svg = select(svgRef.current);
    const behavior = d3zoom()
      .scaleExtent([1, MAX_ZOOM])
      .translateExtent([
        [0, -northSlack],
        [WIDTH, height],
      ])
      .on('zoom', (event) => setTransform(event.transform));
    if (wheelNeedsModifier) {
      behavior.filter((event) => {
        if (event.type === 'wheel') {
          const ok = event.ctrlKey || event.metaKey;
          if (!ok) blockedRef.current?.();
          return ok;
        }
        return !event.button; // mismo comportamiento por defecto para ratón y táctil
      });
    }
    svg.call(behavior).on('dblclick.zoom', null);
    zoomRef.current = behavior;
    return () => svg.on('.zoom', null);
  }, [svgRef, height, northSlack, wheelNeedsModifier]);

  const moveTo = useCallback(
    (target, duration) => {
      if (!zoomRef.current) return;
      const svg = select(svgRef.current);
      if (reducedMotion()) {
        setFading(true);
        svg.interrupt().call(zoomRef.current.transform, target);
        requestAnimationFrame(() => requestAnimationFrame(() => setFading(false)));
        return;
      }
      svg.interrupt().transition().duration(duration).ease(easeInOutCubic).call(zoomRef.current.transform, target);
    },
    [svgRef],
  );

  const zoomBy = (factor) => select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, factor);
  const reset = useCallback((duration = 700) => moveTo(zoomIdentity, duration), [moveTo]);

  /** Centra el mapa en (x, y) con zoom k. */
  const focus = useCallback(
    (x, y, k, duration = 900) => moveTo(zoomIdentity.translate(WIDTH / 2, height / 2).scale(k).translate(-x, -y), duration),
    [moveTo, height],
  );

  /** Encuadra un rectángulo [[x0, y0], [x1, y1]] del mapa dejando un margen. */
  const fitBounds = useCallback(
    ([[x0, y0], [x1, y1]], { padding = 0.12, maxZoom = 9, duration = 1100 } = {}) => {
      const w = Math.max(x1 - x0, 1);
      const h = Math.max(y1 - y0, 1);
      const k = Math.min(maxZoom, (1 - padding * 2) / Math.max(w / WIDTH, h / height));
      focus((x0 + x1) / 2, (y0 + y1) / 2, Math.max(1, k), duration);
    },
    [focus, height],
  );

  /** Mismo encuadre que fitBounds, con la duración por defecto (nombre que usa el mapa en directo de la portada). */
  const zoomToBox = useCallback((box, options) => fitBounds(box, { duration: 900, ...options }), [fitBounds]);

  return { transform, zoomBy, reset, focus, fitBounds, zoomToBox, fading };
}
