import { memo, useMemo, useRef, useState } from 'react';
import { WIDTH, buildBase, buildGeometry } from '../lib/mapGeometry.js';
import { useMapZoom } from '../lib/useMapZoom.js';
import { BaseLayer, LabelLayer, ZoomControls } from './MapBase.jsx';

/** Mapa SVG de España con provincias, países vecinos y líneas de alta velocidad. */
export default function RailMap({ provinces, countries, lines, hoveredId, selectedId, onHover, onSelect }) {
  const svgRef = useRef(null);
  const [pointer, setPointer] = useState(null);

  const geo = useMemo(() => buildGeometry(provinces, countries), [provinces, countries]);
  const base = useMemo(() => buildBase(provinces, countries, geo), [provinces, countries, geo]);
  const { transform, zoomBy, reset } = useMapZoom(svgRef, geo.height);

  const lineShapes = useMemo(
    () =>
      lines.map((line) => ({
        line,
        d: geo.path({ type: 'MultiLineString', coordinates: line.coords }),
        stops: line.coords[0].map((c) => geo.projection(c)),
      })),
    [lines, geo],
  );

  const activeId = hoveredId ?? selectedId;
  const active = activeId ? lineShapes.find((s) => s.line.id === activeId) : null;
  const k = transform.k;

  const handleMove = (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    setPointer({ x, y: event.clientY - rect.top, flip: x > rect.width * 0.62 });
  };

  return (
    <div className="map-frame" onPointerMove={handleMove} onPointerLeave={() => setPointer(null)}>
      <svg
        ref={svgRef}
        className={`map-svg${active ? ' is-focused' : ''}`}
        viewBox={`0 0 ${WIDTH} ${geo.height}`}
        role="img"
        aria-label="Mapa de la red de alta velocidad de España"
      >
        <rect className="map-sea" y={-1000} width={WIDTH} height={geo.height + 1000} onClick={() => onSelect(null)} />
        <g transform={transform.toString()}>
          <BaseLayer {...base} inset={geo.inset} />
          <LineLayer shapes={lineShapes} onHover={onHover} onSelect={onSelect} />
          {active && <ActiveLine shape={active} k={k} />}
          <LabelLayer {...base} k={k} />
        </g>
      </svg>

      <ZoomControls zoomBy={zoomBy} reset={reset} />

      {active && hoveredId && pointer && <Tooltip line={active.line} pointer={pointer} />}
    </div>
  );
}

const LineLayer = memo(function LineLayer({ shapes, onHover, onSelect }) {
  return (
    <g className="lines">
      {shapes.map(({ line, d }) => (
        <path key={line.id} className="line" d={d} stroke={line.color} />
      ))}
      {/* Zonas invisibles más anchas para que sea fácil pasar el ratón por encima */}
      <g className="hits">
        {shapes.map(({ line, d }) => (
          <path
            key={line.id}
            d={d}
            onPointerEnter={() => onHover(line.id)}
            onPointerLeave={() => onHover(null)}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(line.id);
            }}
          />
        ))}
      </g>
    </g>
  );
});

function ActiveLine({ shape, k }) {
  const { line, d, stops } = shape;
  return (
    <g className="active-line" pointerEvents="none">
      <path d={d} className="active-casing" />
      <path d={d} className="active-stroke" stroke={line.color} />
      {stops.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4 / k} className="active-stop" stroke={line.color} strokeWidth={2 / k} />
      ))}
    </g>
  );
}

function Tooltip({ line, pointer }) {
  return (
    <div className={`map-tooltip${pointer.flip ? ' is-flipped' : ''}`} style={{ left: pointer.x, top: pointer.y }}>
      <div className="tooltip-title">
        <span className="swatch" style={{ background: line.color }} />
        {line.name}
      </div>
      <div className="tooltip-meta">
        {line.types.join(', ')} · {line.stops.length} paradas
      </div>
    </div>
  );
}
