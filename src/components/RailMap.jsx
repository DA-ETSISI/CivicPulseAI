import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { geoConicConformal, geoMercator, geoPath } from 'd3-geo';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';

const WIDTH = 1000;
const PAD = 18;
const MAX_ZOOM = 12;
const CANARY = new Set(['35', '38']);
/** Punto extra para que el encuadre incluya el sur de Francia (la línea a Lyon sigue al hacer zoom). */
const NORTH_EAST = [4.4, 44.25];
/** Margen extra (en px del mapa) para poder desplazarse hacia el norte hasta Lyon con zoom. */
const NORTH_SLACK = 260;
const COUNTRY_LABELS = [
  { name: 'Portugal', at: [-8.05, 39.75] },
  { name: 'Francia', at: [1.6, 43.85] },
];

/** Construye las proyecciones: península + países vecinos, y Canarias en un recuadro aparte. */
function buildGeometry(provinces, countries) {
  const mainland = provinces.features.filter((f) => !CANARY.has(f.properties.code));
  const canary = { type: 'FeatureCollection', features: provinces.features.filter((f) => CANARY.has(f.properties.code)) };
  const portugal = countries.features.filter((f) => f.properties.name === 'Portugal');
  const target = {
    type: 'FeatureCollection',
    features: [...mainland, ...portugal, { type: 'Feature', geometry: { type: 'Point', coordinates: NORTH_EAST } }],
  };

  const projection = geoConicConformal().parallels([37, 44]).rotate([3, 0]).fitWidth(WIDTH - 2 * PAD, target);
  const [[x0, y0], [, y1]] = geoPath(projection).bounds(target);
  const [tx, ty] = projection.translate();
  projection.translate([tx + PAD - x0, ty + PAD - y0]);
  const height = Math.round(y1 - y0 + 2 * PAD);

  const inset = { x: PAD, y: height - PAD - 92, w: 200, h: 92 };
  const insetProjection = geoMercator().fitExtent(
    [
      [inset.x + 10, inset.y + 16],
      [inset.x + inset.w - 10, inset.y + inset.h - 8],
    ],
    canary,
  );

  return { projection, path: geoPath(projection), insetPath: geoPath(insetProjection), height, inset, canary };
}

/** Mapa SVG de España con provincias, países vecinos y líneas de alta velocidad. */
export default function RailMap({ provinces, countries, lines, hoveredId, selectedId, onHover, onSelect }) {
  const svgRef = useRef(null);
  const zoomRef = useRef(null);
  const [transform, setTransform] = useState(zoomIdentity);
  const [pointer, setPointer] = useState(null);

  const geo = useMemo(() => buildGeometry(provinces, countries), [provinces, countries]);
  const { height } = geo;

  const base = useMemo(() => {
    const provinceShapes = provinces.features.map((f) => {
      const p = CANARY.has(f.properties.code) ? geo.insetPath : geo.path;
      const [x, y] = p.centroid(f);
      return {
        name: f.properties.name,
        d: p(f),
        x,
        y,
        size: Math.max(7.5, Math.min(11, Math.sqrt(p.area(f)) / 9)),
      };
    });
    const countryShapes = countries.features.map((f) => ({ name: f.properties.name, d: geo.path(f) }));
    const countryLabels = COUNTRY_LABELS.map((c) => {
      const [x, y] = geo.projection(c.at);
      return { ...c, x, y };
    });
    return { provinceShapes, countryShapes, countryLabels };
  }, [provinces, countries, geo]);

  const lineShapes = useMemo(
    () =>
      lines.map((line) => ({
        line,
        d: geo.path({ type: 'MultiLineString', coordinates: line.coords }),
        stops: line.coords[0].map((c) => geo.projection(c)),
      })),
    [lines, geo],
  );

  // Zoom y desplazamiento
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
  }, [height]);

  const zoomBy = (factor) => select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, factor);
  const resetZoom = () => select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, zoomIdentity);

  const activeId = hoveredId ?? selectedId;
  const active = activeId ? lineShapes.find((s) => s.line.id === activeId) : null;
  const k = transform.k;

  const handleMove = (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    setPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top, flip: event.clientX - rect.left > rect.width * 0.62 });
  };

  return (
    <div className="map-frame" onPointerMove={handleMove} onPointerLeave={() => setPointer(null)}>
      <svg
        ref={svgRef}
        className={`map-svg${active ? ' is-focused' : ''}`}
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-label="Mapa de la red de alta velocidad de España"
      >
        <rect className="map-sea" width={WIDTH} height={height} onClick={() => onSelect(null)} />
        <g transform={transform.toString()}>
          <BaseLayer {...base} inset={geo.inset} k={k} />
          <LineLayer shapes={lineShapes} onHover={onHover} onSelect={onSelect} />
          {active && <ActiveLine shape={active} k={k} />}
          <LabelLayer {...base} k={k} />
        </g>
      </svg>

      <div className="map-zoom" role="group" aria-label="Zoom del mapa">
        <button type="button" onClick={() => zoomBy(1.6)} aria-label="Acercar">+</button>
        <button type="button" onClick={() => zoomBy(1 / 1.6)} aria-label="Alejar">−</button>
        <button type="button" onClick={resetZoom} aria-label="Restablecer vista">⟲</button>
      </div>

      {active && hoveredId && pointer && <Tooltip line={active.line} pointer={pointer} />}
    </div>
  );
}

const BaseLayer = memo(function BaseLayer({ countryShapes, provinceShapes, inset }) {
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

const LabelLayer = memo(function LabelLayer({ provinceShapes, countryLabels, k }) {
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
