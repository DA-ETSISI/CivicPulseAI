import { useCallback, useEffect, useRef, useState } from 'react';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import { NORTH_SLACK, WIDTH } from './mapGeometry.js';

const MAX_ZOOM = 12;

/**
 * Zoom con rueda / pellizco y botones +, −, restablecer.
 *
 * Opciones:
 *  - `wheelNeedsModifier`: la rueda solo hace zoom con Ctrl (o ⌘) pulsado, para que el mapa
 *    no «atrape» el scroll de la página. Llama a `onWheelBlocked` cuando se intenta sin Ctrl.
 */
export function useMapZoom(svgRef, height, { wheelNeedsModifier = false, onWheelBlocked } = {}) {
  const zoomRef = useRef(null);
  const blockedRef = useRef(onWheelBlocked);
  blockedRef.current = onWheelBlocked;
  const [transform, setTransform] = useState(zoomIdentity);

  useEffect(() => {
    const svg = select(svgRef.current);
    const behavior = d3zoom()
      .scaleExtent([1, MAX_ZOOM])
      .translateExtent([
        [0, -NORTH_SLACK],
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
  }, [svgRef, height, wheelNeedsModifier]);

  const zoomBy = (factor) => select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, factor);
  const reset = useCallback(
    () => select(svgRef.current).transition().duration(700).call(zoomRef.current.transform, zoomIdentity),
    [svgRef],
  );

  /** Encuadra la caja [[x0, y0], [x1, y1]] (en coordenadas del mapa) con una animación. */
  const zoomToBox = useCallback(
    ([[x0, y0], [x1, y1]], { padding = 0.12, maxZoom = 9 } = {}) => {
      const w = Math.max(x1 - x0, 1);
      const h = Math.max(y1 - y0, 1);
      const k = Math.max(1, Math.min(maxZoom, (1 - 2 * padding) / Math.max(w / WIDTH, h / height)));
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const target = zoomIdentity.translate(WIDTH / 2 - k * cx, height / 2 - k * cy).scale(k);
      select(svgRef.current).transition().duration(900).call(zoomRef.current.transform, target);
    },
    [svgRef, height],
  );

  return { transform, zoomBy, reset, zoomToBox };
}
