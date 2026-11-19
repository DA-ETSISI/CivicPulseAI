import { useCallback, useEffect, useRef, useState } from 'react';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import { NORTH_SLACK, WIDTH } from './mapGeometry.js';

const MAX_ZOOM = 12;

/** Zoom con rueda / pellizco, botones +, −, restablecer y centrado en un punto (seguir un tren). */
export function useMapZoom(svgRef, height) {
  const zoomRef = useRef(null);
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
    svg.call(behavior).on('dblclick.zoom', null);
    zoomRef.current = behavior;
    return () => svg.on('.zoom', null);
  }, [svgRef, height]);

  const zoomBy = (factor) => select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, factor);
  const reset = () => select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, zoomIdentity);

  /** Centra el mapa en (x, y) con zoom k, con una transición suave. */
  const focus = useCallback(
    (x, y, k) => {
      if (!zoomRef.current) return;
      const target = zoomIdentity.translate(WIDTH / 2, height / 2).scale(k).translate(-x, -y);
      select(svgRef.current).transition().duration(900).call(zoomRef.current.transform, target);
    },
    [svgRef, height],
  );

  return { transform, zoomBy, reset, focus };
}
