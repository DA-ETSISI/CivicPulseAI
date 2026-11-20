import { memo, useMemo } from 'react';

/**
 * Red ferroviaria de España (OpenStreetMap) como fondo del mapa, solo visual.
 * No recibe clics: así el clic y el doble clic llegan a las líneas de Renfe que hay encima
 * (clic = ver la línea, doble clic = comprar billete de ese tramo).
 */
export default memo(function RailNetwork({ data, path }) {
  const d = useMemo(() => path(data.network), [data, path]);
  return (
    <g className="rail-net" pointerEvents="none">
      <path className="rail-net-base" d={d} />
    </g>
  );
});
