import { memo } from 'react';

/** Fondo del mapa: países vecinos, recuadro de Canarias y provincias. */
export const BaseLayer = memo(function BaseLayer({ countryShapes, provinceShapes, inset }) {
  return (
    <g pointerEvents="none">
      <g className="countries">
        {countryShapes.map((c) => (
          <path key={c.name} d={c.d} />
        ))}
      </g>
      <rect className="map-inset" x={inset.x} y={inset.y} width={inset.w} height={inset.h} rx="8" />
      <text className="map-inset-label" x={inset.x + 10} y={inset.y + 13}>
        Islas Canarias
      </text>
      <g className="provinces">
        {provinceShapes.map((s) => (
          <path key={s.name} d={s.d} />
        ))}
      </g>
    </g>
  );
});

/** Nombres de países y provincias; mantienen un tamaño legible al hacer zoom. */
export const LabelLayer = memo(function LabelLayer({ provinceShapes, countryLabels, k }) {
  return (
    <g aria-hidden="true">
      <g className="country-labels">
        {countryLabels.map((c) => (
          <text key={c.name} x={c.x} y={c.y} fontSize={13 / Math.sqrt(k)}>
            {c.name}
          </text>
        ))}
      </g>
      <g className="labels">
        {provinceShapes.map((s) => (
          <text key={s.name} x={s.x} y={s.y} fontSize={s.size / Math.sqrt(k)} strokeWidth={3 / k}>
            {s.name}
          </text>
        ))}
      </g>
    </g>
  );
});

export function ZoomControls({ zoomBy, reset }) {
  return (
    <div className="map-zoom" role="group" aria-label="Zoom del mapa">
      <button type="button" onClick={() => zoomBy(1.6)} aria-label="Acercar">+</button>
      <button type="button" onClick={() => zoomBy(1 / 1.6)} aria-label="Alejar">−</button>
      <button type="button" onClick={reset} aria-label="Restablecer vista">⟲</button>
    </div>
  );
}
