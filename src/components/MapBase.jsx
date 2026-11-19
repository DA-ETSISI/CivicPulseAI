import { memo } from 'react';
import { IconFit, IconMinus, IconPlus } from './icons.jsx';

/**
 * Fondo del mapa: países vecinos, recuadro de Canarias y provincias.
 * Con `withProvinces={false}` las provincias las dibuja aparte <ProvinceLayer>, que sí se puede pulsar.
 */
export const BaseLayer = memo(function BaseLayer({ countryShapes, provinceShapes, inset, withProvinces = true }) {
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
      {withProvinces && (
        <g className="provinces">
          {provinceShapes.map((s) => (
            <path key={s.name} d={s.d} />
          ))}
        </g>
      )}
    </g>
  );
});

/** Provincias que se iluminan al pasar el ratón y se pueden pulsar para ver su red de Cercanías. */
export const ProvinceLayer = memo(function ProvinceLayer({ provinceShapes, activeCode, onEnter, onLeave, onPick }) {
  return (
    <g className={`provinces is-interactive${activeCode ? ' has-active' : ''}`}>
      {provinceShapes.map((s) => (
        <path
          key={s.name}
          d={s.d}
          data-code={s.code}
          className={`province${s.hasNetwork ? ' has-network' : ''}${s.code === activeCode ? ' is-active' : ''}`}
          onPointerEnter={(e) => onEnter(s, e)}
          onPointerMove={(e) => onEnter(s, e)}
          onPointerLeave={onLeave}
          onClick={(e) => {
            e.stopPropagation();
            onPick(s);
          }}
        />
      ))}
    </g>
  );
});

/** Nombres de países y provincias; mantienen un tamaño legible al hacer zoom. */
export const LabelLayer = memo(function LabelLayer({ provinceShapes, countryLabels, k, hidden = null }) {
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
        {/* `hidden`: provincias cuyo nombre ya se muestra como ciudad cabecera, para no repetirlo. */}
        {provinceShapes.filter((s) => !hidden?.has(s.name)).map((s) => (
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
      <button type="button" onClick={() => zoomBy(1.6)} aria-label="Acercar" title="Acercar">
        <IconPlus />
      </button>
      <button type="button" onClick={() => zoomBy(1 / 1.6)} aria-label="Alejar" title="Alejar">
        <IconMinus />
      </button>
      <button type="button" onClick={() => reset()} aria-label="Ver el mapa completo" title="Ver el mapa completo">
        <IconFit />
      </button>
    </div>
  );
}
