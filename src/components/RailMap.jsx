import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { geoPath } from 'd3-geo';
import { geoConicConformalSpain } from 'd3-composite-projections';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import { CATEGORY_BY_ID } from '../lib/categories.js';

const WIDTH = 1000;
const HEIGHT = 760;
const MAX_ZOOM = 14;

/** Mapa SVG de España con provincias y líneas ferroviarias. Zoom con rueda/pellizco. */
export default function RailMap({ provinces, lines, hoveredId, selectedId, onHover, onSelect }) {
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const [transform, setTransform] = useState(zoomIdentity);
  const [pointer, setPointer] = useState(null);

  const { provinceShapes, lineShapes, frame } = useMemo(() => {
    const projection = geoConicConformalSpain().fitExtent(
      [
        [16, 16],
        [WIDTH - 16, HEIGHT - 16],
      ],
      provinces,
    );
    const path = geoPath(projection);
    const provinceShapes = provinces.features.map((f) => {
      const [x, y] = path.centroid(f);
      const area = path.area(f);
      return {
        name: f.properties.name,
        d: path(f),
        x,
        y,
        size: Math.max(7.5, Math.min(11, Math.sqrt(area) / 9)),
      };
    });
    const lineShapes = lines.map((line) => ({
      line,
      d: path({ type: 'MultiLineString', coordinates: line.coords }),
      stops: line.category === 'cer' ? [] : line.coords[0].map((c) => projection(c)).filter(Boolean),
    }));
    return { provinceShapes, lineShapes, frame: projection.getCompositionBorders() };
  }, [provinces, lines]);

  // Zoom y desplazamiento
  useEffect(() => {
    const svg = select(svgRef.current);
    const behavior = d3zoom()
      .scaleExtent([1, MAX_ZOOM])
      .translateExtent([
        [0, 0],
        [WIDTH, HEIGHT],
      ])
      .on('zoom', (event) => setTransform(event.transform));
    svg.call(behavior).on('dblclick.zoom', null);
    zoomRef.current = behavior;
    return () => svg.on('.zoom', null);
  }, []);

  const zoomBy = (factor) => select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, factor);
  const resetZoom = () => select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, zoomIdentity);

  const activeId = hoveredId ?? selectedId;
  const active = activeId ? lineShapes.find((s) => s.line.id === activeId) : null;
  const k = transform.k;

  const handleMove = (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    setPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  return (
    <div className="map-frame" onPointerMove={handleMove} onPointerLeave={() => setPointer(null)}>
      <svg
        ref={svgRef}
        className={`map-svg${active ? ' is-focused' : ''}`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Mapa de la red ferroviaria de España"
        onClick={(e) => e.target === svgRef.current && onSelect(null)}
      >
        <rect className="map-sea" width={WIDTH} height={HEIGHT} onClick={() => onSelect(null)} />
        <g transform={transform.toString()}>
          <ProvinceLayer shapes={provinceShapes} />
          <path className="map-inset" d={frame} />
          <LineLayer shapes={lineShapes} onHover={onHover} onSelect={onSelect} />
          {active && <ActiveLine shape={active} k={k} />}
          <LabelLayer shapes={provinceShapes} k={k} />
        </g>
      </svg>

      <div className="map-zoom" role="group" aria-label="Zoom del mapa">
        <button type="button" onClick={() => zoomBy(1.6)} aria-label="Acercar">+</button>
        <button type="button" onClick={() => zoomBy(1 / 1.6)} aria-label="Alejar">−</button>
        <button type="button" onClick={resetZoom} aria-label="Restablecer vista" className="map-zoom-reset">⟲</button>
      </div>

      {active && hoveredId && pointer && <Tooltip line={active.line} pointer={pointer} />}
    </div>
  );
}

const ProvinceLayer = memo(function ProvinceLayer({ shapes }) {
  return (
    <g className="provinces">
      {shapes.map((s) => (
        <path key={s.name} d={s.d} />
      ))}
    </g>
  );
});

const LineLayer = memo(function LineLayer({ shapes, onHover, onSelect }) {
  return (
    <g className="lines">
      {shapes.map(({ line, d }) => (
        <path
          key={line.id}
          className="line"
          d={d}
          stroke={line.color}
          strokeWidth={CATEGORY_BY_ID[line.category].width}
        />
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
  const width = CATEGORY_BY_ID[line.category].width + 1.6;
  return (
    <g className="active-line" pointerEvents="none">
      <path d={d} className="active-casing" strokeWidth={width + 3} />
      <path d={d} stroke={line.color} strokeWidth={width} />
      {stops.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.2 / k} fill="var(--surface)" stroke={line.color} strokeWidth={1.6 / k} />
      ))}
    </g>
  );
}

const LabelLayer = memo(function LabelLayer({ shapes, k }) {
  return (
    <g className="labels" aria-hidden="true">
      {shapes.map((s) => (
        <text key={s.name} x={s.x} y={s.y} fontSize={s.size / Math.sqrt(k)} strokeWidth={3 / k}>
          {s.name}
        </text>
      ))}
    </g>
  );
});

function Tooltip({ line, pointer }) {
  const category = CATEGORY_BY_ID[line.category];
  return (
    <div className="map-tooltip" style={{ left: pointer.x, top: pointer.y }}>
      <div className="tooltip-title">
        <span className="swatch" style={{ background: line.color }} />
        {line.name}
      </div>
      <div className="tooltip-meta">
        {category.label} · {line.types.join(', ')}
      </div>
      {line.category !== 'cer' && <div className="tooltip-meta">{line.stops.length} paradas</div>}
    </div>
  );
}
