import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { WIDTH, buildBase, buildGeometry } from '../../lib/mapGeometry.js';
import { useMapZoom } from '../../lib/useMapZoom.js';
import { CITY_RADIUS_KM, SERVICES, SERVICE_BY_ID } from '../../lib/trainFilters.js';
import { BaseLayer, LabelLayer, ZoomControls } from '../MapBase.jsx';
import { useRailways } from '../../lib/useRailways.js';
import RailNetwork from './RailNetwork.jsx';

const CANARY = new Set(['35', '38']);
/** Tamaño de cada punto según el tipo de tren (en píxeles de pantalla). */
const RADIUS = { larga: 5, media: 4.3, corta: 3.4 };

/**
 * Mapa de España con todos los trenes en su posición GPS, coloreados por tipo de servicio.
 * Cuando cambia `focus` (provincia, ciudad o red de Cercanías) se acerca a esa zona.
 * Las líneas se pueden seleccionar (clic) y con doble clic se va a comprar un billete de ese trayecto.
 */
export default function TrainMap({
  provinces,
  countries,
  tracks,
  trains,
  focus,
  selectedId,
  onSelect,
  selectedLineId,
  onSelectLine,
  onBookLine,
  onBookTrain,
}) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [wheelHint, setWheelHint] = useState(false);
  const hintTimer = useRef(0);
  const railways = useRailways();

  const geo = useMemo(() => buildGeometry(provinces, countries), [provinces, countries]);
  const base = useMemo(() => buildBase(provinces, countries, geo), [provinces, countries, geo]);
  const trackPaths = useMemo(
    () => tracks.map((l) => ({ line: l, d: geo.path({ type: 'MultiLineString', coordinates: l.coords }) })),
    [tracks, geo],
  );

  const { transform, zoomBy, reset, zoomToBox } = useMapZoom(svgRef, geo.height, {
    wheelNeedsModifier: true,
    onWheelBlocked: () => {
      setWheelHint(true);
      clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setWheelHint(false), 1400);
    },
  });
  const k = transform.k;

  const dots = useMemo(
    () =>
      trains
        .map((t) => {
          const p = geo.projection([t.lon, t.lat]);
          return p ? { train: t, x: p[0], y: p[1] } : null;
        })
        .filter(Boolean)
        // Los de larga distancia se dibujan los últimos para que queden por encima.
        .sort((a, b) => RADIUS[a.train.service] - RADIUS[b.train.service]),
    [trains, geo],
  );

  // Encuadre automático al elegir una zona. Solo reacciona al cambio de zona, no a cada
  // actualización de posiciones (si no, el mapa «saltaría» cada 20 s).
  const dotsRef = useRef(dots);
  dotsRef.current = dots;
  const focusKey = focus ? `${focus.kind}:${focus.code ?? focus.id ?? focus.name}` : '';
  useEffect(() => {
    if (!focus) {
      reset();
      return;
    }
    const box = boxFor(focus, geo, provinces, dotsRef.current);
    if (box) zoomToBox(box, { maxZoom: focus.kind === 'city' ? 10 : 8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, geo]);

  /** Tooltip de un tren (`{ train }`) o de una línea (`{ line }`) junto al puntero. */
  const showTip = (item) => (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    setHover({ ...item, x, y: event.clientY - rect.top, flip: x > rect.width * 0.6 });
  };
  const hoverLineId = hover?.line?.id ?? null;

  return (
    <div className="map-frame live-map" onPointerLeave={() => setHover(null)}>
      <svg
        ref={svgRef}
        className="map-svg"
        viewBox={`0 0 ${WIDTH} ${geo.height}`}
        role="img"
        aria-label={`Mapa de España con ${trains.length} trenes en tiempo real`}
      >
        <rect
          className="map-sea"
          x={-2000}
          y={-1000}
          width={WIDTH + 4000}
          height={geo.height + 2000}
          onClick={() => {
            onSelect(null);
            onSelectLine(null);
          }}
        />
        <g transform={transform.toString()}>
          <BaseLayer {...base} inset={geo.inset} />
          {focus?.kind === 'province' && <ProvinceHighlight shapes={base.provinceShapes} name={focus.name} />}
          {focus?.kind === 'city' && <CityRing geo={geo} city={focus} k={k} />}
          {/* Red de fondo solo visual: los clics van a las líneas de Renfe (clic = ver, doble clic = billete). */}
          {railways && <RailNetwork data={railways} path={geo.path} />}
          <Tracks
            tracks={trackPaths}
            activeIds={[selectedLineId, hoverLineId]}
            onHover={(line) => (line ? showTip({ line }) : () => setHover(null))}
            onSelect={onSelectLine}
            onBook={onBookLine}
          />
          <LabelLayer {...base} k={k} />
          <g className="live-dots">
            {dots.map(({ train, x, y }) => {
              const selected = train.id === selectedId;
              // Al acercarse, los puntos crecen un poco (pero mucho menos que el mapa).
              const r = (RADIUS[train.service] ?? 4) / Math.pow(k, 0.8);
              return (
                <g key={train.id} className="live-dot-pos" style={{ transform: `translate(${x}px, ${y}px)` }}>
                  {selected && <circle className="live-dot-halo" r={r * 2.6} strokeWidth={2 / k} />}
                  <circle
                    className={`live-dot live-dot--${train.service}${selected ? ' is-selected' : ''}`}
                    r={selected ? r * 1.5 : r}
                    strokeWidth={(selected ? 2 : 1) / k}
                    onPointerEnter={showTip({ train, x, y })}
                    onPointerMove={showTip({ train, x, y })}
                    onPointerLeave={() => setHover(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(train.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onBookTrain(train);
                    }}
                  />
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <ZoomControls zoomBy={zoomBy} reset={reset} />

      <div className="map-legend" aria-hidden="true">
        {SERVICES.map((s) => (
          <span key={s.id}>
            <span className={`svc-dot svc-dot--${s.id}`} />
            {s.label}
          </span>
        ))}
      </div>

      <div className={`wheel-hint${wheelHint ? ' is-visible' : ''}`} aria-hidden="true">
        Usa <kbd>Ctrl</kbd> + rueda para acercar el mapa
      </div>

      {railways && <div className="map-attribution">Vías © OpenStreetMap</div>}

      {hover?.line && (
        <div className={`map-tooltip${hover.flip ? ' is-flipped' : ''}`} style={{ left: hover.x, top: hover.y }}>
          <div className="tooltip-title">{hover.line.name}</div>
          <div className="tooltip-meta">{hover.line.types?.join(' · ')}</div>
          <div className="tooltip-hint">Doble clic para comprar billete</div>
        </div>
      )}
      {hover?.train && (
        <div className={`map-tooltip${hover.flip ? ' is-flipped' : ''}`} style={{ left: hover.x, top: hover.y }}>
          <div className="tooltip-title">
            <span className={`svc-dot svc-dot--${hover.train.service}`} />
            {hover.train.label}
          </div>
          <div className="tooltip-meta">
            {SERVICE_BY_ID[hover.train.service]?.label}
            {hover.train.provinceName && ` · ${hover.train.provinceName}`}
          </div>
          {hover.train.origin && (
            <>
              <div className="tooltip-meta">
                {hover.train.origin} → {hover.train.destination}
              </div>
              <div className="tooltip-hint">Doble clic para comprar billete</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Caja (en coordenadas del mapa) que hay que encuadrar para cada tipo de zona. */
function boxFor(focus, geo, provinces, dots) {
  if (focus.kind === 'province') {
    const f = provinces.features.find((x) => x.properties.code === focus.code);
    if (!f) return null;
    return (CANARY.has(focus.code) ? geo.insetPath : geo.path).bounds(f);
  }
  if (focus.kind === 'city') {
    const dLat = (CITY_RADIUS_KM * 1.15) / 111;
    const dLon = dLat / Math.cos((focus.lat * Math.PI) / 180);
    const a = geo.projection([focus.lon - dLon, focus.lat + dLat]);
    const b = geo.projection([focus.lon + dLon, focus.lat - dLat]);
    return [
      [Math.min(a[0], b[0]), Math.min(a[1], b[1])],
      [Math.max(a[0], b[0]), Math.max(a[1], b[1])],
    ];
  }
  // Red de Cercanías: encuadra los trenes que circulan ahora por ella.
  if (!dots.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const d of dots) {
    x0 = Math.min(x0, d.x); y0 = Math.min(y0, d.y);
    x1 = Math.max(x1, d.x); y1 = Math.max(y1, d.y);
  }
  // Tamaño mínimo para no acercarse demasiado si solo hay uno o dos trenes.
  const min = 40;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const w = Math.max(x1 - x0, min) / 2, h = Math.max(y1 - y0, min) / 2;
  return [
    [cx - w, cy - h],
    [cx + w, cy + h],
  ];
}

const ProvinceHighlight = memo(function ProvinceHighlight({ shapes, name }) {
  const shape = shapes.find((s) => s.name === name);
  return shape ? <path className="province-focus" d={shape.d} pointerEvents="none" /> : null;
});

function CityRing({ geo, city, k }) {
  const c = geo.projection([city.lon, city.lat]);
  const edge = geo.projection([city.lon, city.lat + CITY_RADIUS_KM / 111]);
  if (!c || !edge) return null;
  return (
    <g pointerEvents="none">
      <circle className="city-ring" cx={c[0]} cy={c[1]} r={Math.abs(c[1] - edge[1])} strokeWidth={1.5 / k} />
      <circle className="city-pin" cx={c[0]} cy={c[1]} r={3.5 / k} />
    </g>
  );
}

/**
 * Vías de alta velocidad. Cada una lleva debajo un trazo ancho e invisible para que sea fácil
 * de señalar con el ratón o el dedo. Clic: seleccionar · doble clic: comprar billete.
 */
function Tracks({ tracks, activeIds, onHover, onSelect, onBook }) {
  return (
    <g className="live-tracks live-tracks--interactive">
      {/* La línea activa se dibuja la última para que quede por encima de las demás. */}
      {[...tracks].sort((a, b) => activeIds.includes(a.line.id) - activeIds.includes(b.line.id)).map(({ line, d }) => {
        const active = activeIds.includes(line.id);
        return (
          <g key={line.id} className={`live-track${active ? ' is-active' : ''}`}>
            <path className="live-track-line" d={d} />
            <path
              className="live-track-hit"
              d={d}
              onPointerEnter={onHover(line)}
              onPointerMove={onHover(line)}
              onPointerLeave={onHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(line.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onBook(line);
              }}
            >
              <title>{`${line.name} · doble clic para comprar billete`}</title>
            </path>
          </g>
        );
      })}
    </g>
  );
}
