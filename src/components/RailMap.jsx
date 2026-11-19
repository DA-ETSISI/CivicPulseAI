import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { WIDTH, buildBase, buildGeometry } from '../lib/mapGeometry.js';
import { useMapZoom } from '../lib/useMapZoom.js';
import { LABEL_FONT_PX, clearLabelCache, groupTerminals, placeLabels } from '../lib/mapLabels.js';
import { BaseLayer, LabelLayer, ProvinceLayer, ZoomControls } from './MapBase.jsx';

const STAGGER_MS = 90;
const MAX_STAGGER_MS = 900;
const DRAW_MS = 900;
/** Cabeceras con al menos tantas líneas llevan el nombre de la ciudad en la vista general. */
const CITY_LABEL_MIN_LINES = 5;

/**
 * Grosor de los trazos en píxeles de pantalla (igual que en index.css). Los remates de inicio y fin
 * tienen exactamente este diámetro para encajar en la línea como un tapón.
 */
const WIDTHS = { base: 3.6, preview: 4.4, selected: 6, cer: 3.4 };
const WIDTHS_NARROW = { base: 2.6, preview: 3.4, selected: 4.5, cer: 3.4 };

function useNarrow() {
  const query = '(max-width: 720px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

/**
 * Píxeles de pantalla por unidad del mapa. Las líneas se dibujan con grosor fijo en pantalla
 * (non-scaling-stroke) y los remates en unidades del mapa, así que hay que convertir para que encajen.
 */
function useSvgScale(svgRef) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const measure = () => setScale(svg.getBoundingClientRect().width / WIDTH || 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [svgRef]);
  return scale;
}

/** Color del remate: el mismo tono de la línea, más oscuro (en OKLCH, para que no cambie de matiz). */
const capColor = (color) => `color-mix(in oklch, ${color ?? 'var(--accent)'} 62%, black)`;

/** Extremos reales del trazado (no de las estaciones), para que el remate cierre la línea. */
function pathEnds(coords, project) {
  const segs = coords.filter((c) => c.length > 1);
  if (!segs.length) return [];
  return [project(segs[0][0]), project(segs.at(-1).at(-1))].filter(Boolean);
}

/** Vuelve a medir las etiquetas cuando termina de cargar la fuente. */
function useFontsReady() {
  const [ready, setReady] = useState(() => document.fonts?.status === 'loaded');
  useEffect(() => {
    if (ready || !document.fonts) return;
    document.fonts.ready.then(() => {
      clearLabelCache();
      setReady(true);
    });
  }, [ready]);
  return ready;
}

/**
 * Mapa de la red de alta velocidad.
 * - Vista general: cada línea termina en un remate de su mismo grosor y color más oscuro; las líneas sin
 *   servicio a esta hora se atenúan.
 * - Pasar el ratón por una línea la previsualiza; por una de sus paradas, enseña los nombres de todas.
 * - Pulsar una línea la fija con sus paradas etiquetadas; pulsar una parada la resalta.
 * - Pulsar una provincia vuela hasta ella y dibuja su red de Cercanías línea a línea.
 * En pantallas táctiles: un toque previsualiza (con nombres) y un segundo toque fija.
 */
export default function RailMap({
  provinces,
  countries,
  lines,
  fitLines,
  hoveredId,
  selectedId,
  highlightedStop,
  onHover,
  onSelect,
  onStopPick,
  province,
  hoveredCerId,
  onHoverCer,
  onProvincePick,
}) {
  const svgRef = useRef(null);
  const pointerType = useRef('mouse');
  const [tip, setTip] = useState(null);
  const [touchPreviewId, setTouchPreviewId] = useState(null);
  const widths = useNarrow() ? WIDTHS_NARROW : WIDTHS;
  const unitPx = useSvgScale(svgRef);
  const [stopHoverLine, setStopHoverLine] = useState(null);
  const fontsReady = useFontsReady();

  // Encuadre: provincias + Portugal + todos los puntos de todas las rutas.
  const fitPoints = useMemo(() => fitLines.flatMap((l) => l.coords.flat()), [fitLines]);
  const geo = useMemo(() => buildGeometry(provinces, countries, fitPoints), [provinces, countries, fitPoints]);
  const base = useMemo(() => buildBase(provinces, countries, geo), [provinces, countries, geo]);
  const { transform, zoomBy, reset, fitBounds, fading } = useMapZoom(svgRef, geo.height, { northSlack: 0 });
  const k = transform.k;

  const lineShapes = useMemo(
    () =>
      lines.map((line) => {
        const geometry = { type: 'MultiLineString', coordinates: line.coords };
        return {
          line,
          d: geo.path(geometry),
          bounds: geo.path.bounds(geometry),
          stops: (line.stopCoords ?? line.coords[0]).map((c) => geo.projection(c)),
          ends: pathEnds(line.coords, geo.projection),
        };
      }),
    [lines, geo],
  );
  const shapeById = useMemo(() => new Map(lineShapes.map((s) => [s.line.id, s])), [lineShapes]);

  const cerShapes = useMemo(
    () =>
      (province?.lines ?? []).map((line, i) => ({
        line,
        d: geo.path({ type: 'MultiLineString', coordinates: line.coords }),
        stations: line.stations.map((s) => ({ name: s.name, p: geo.projection([s.lon, s.lat]) })).filter((s) => s.p),
        // Cada ramal (forma) de la línea tiene sus dos extremos; se quitan los repetidos.
        ends: line.coords
          .flatMap((c) => pathEnds([c], geo.projection))
          .filter((p, i, all) => all.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5) === i),
        delay: Math.min(i * STAGGER_MS, MAX_STAGGER_MS),
      })),
    [province?.lines, geo],
  );

  const provinceCode = province?.code ?? null;
  const selected = provinceCode ? null : (shapeById.get(selectedId) ?? null);
  const previewId = provinceCode ? null : (hoveredId ?? touchPreviewId);
  const preview = previewId && previewId !== selected?.line.id ? (shapeById.get(previewId) ?? null) : null;
  // Nombres de la línea previsualizada: con el ratón sobre una de sus paradas, o tras el primer toque.
  const previewLabels = Boolean(preview && (stopHoverLine === preview.line.id || touchPreviewId === preview.line.id));

  // Cabeceras de la vista general, agrupadas según el zoom actual.
  const terminals = useMemo(() => groupTerminals(lineShapes, k), [lineShapes, k]);
  // Una sola etiqueta por ciudad (con zoom, Atocha y Chamartín pueden quedar en grupos distintos).
  const cityLabels = useMemo(() => {
    const byCity = new Map();
    for (const g of terminals) {
      if (g.lineIds.length < CITY_LABEL_MIN_LINES) continue;
      if (!byCity.has(g.city) || byCity.get(g.city).lineIds.length < g.lineIds.length) byCity.set(g.city, g);
    }
    return [...byCity.values()];
  }, [terminals]);
  // No repetir «Madrid» como provincia y como ciudad (se compara sin tildes: Valencia / València).
  const hiddenProvinceLabels = useMemo(() => {
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const cities = new Set(cityLabels.flatMap((g) => g.city.split('/').map(norm)));
    return new Set(base.provinceShapes.filter((p) => cities.has(norm(p.name))).map((p) => p.name));
  }, [cityLabels, base]);

  // Cámara: al elegir una ruta se encuadra; al entrar o salir de una provincia, vuelo de ida o de vuelta.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (provinceCode) {
      const shape = base.provinceShapes.find((s) => s.code === provinceCode);
      if (shape) fitBounds(shape.bounds, { padding: 0.08, maxZoom: 10, duration: 1300 });
    } else if (selected) {
      fitBounds(selected.bounds, { padding: 0.12, maxZoom: 6, duration: 1000 });
    } else {
      reset(1100);
    }
    // Se reacciona al id elegido, no a cada nuevo objeto de la ruta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinceCode, selectedId, base, fitBounds, reset]);

  // Si cambia la selección, se olvida la previsualización táctil.
  useEffect(() => setTouchPreviewId(null), [selectedId, provinceCode]);

  const pointerTip = (event, content) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    setTip({ ...content, x, y: event.clientY - rect.top, flip: x > rect.width * 0.62 });
  };

  const clearFocus = () => {
    setTouchPreviewId(null);
    setStopHoverLine(null);
    onSelect(null);
  };

  const handleLineClick = (line) => {
    // En táctil, el primer toque solo previsualiza la línea con sus nombres; el segundo la fija.
    if (pointerType.current === 'touch' && line.id !== selectedId && touchPreviewId !== line.id) {
      setTouchPreviewId(line.id);
      return;
    }
    setTouchPreviewId(null);
    onSelect(line.id);
  };

  const handleStopActivate = (line, index) => {
    if (pointerType.current === 'touch' && line.id !== selectedId && touchPreviewId !== line.id) {
      setTouchPreviewId(line.id);
      return;
    }
    setTouchPreviewId(null);
    onStopPick(line.id, index);
  };

  const handleProvincePick = (shape) => {
    // Con una línea elegida o previsualizada, pulsar el fondo del mapa primero la deselecciona.
    if (selectedId || touchPreviewId) {
      clearFocus();
      return;
    }
    // Las provincias sin red de Cercanías no reaccionan al clic (solo muestran un texto al pasar el ratón).
    if (shape.hasNetwork) onProvincePick(shape.code);
  };

  const svgClass = [
    'map-svg',
    selected ? 'has-selection' : preview ? 'has-preview' : '',
    previewLabels ? 'has-stop-labels' : '',
    provinceCode ? 'is-province' : '',
    fading ? 'is-fading' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="map-frame"
      onPointerDownCapture={(e) => (pointerType.current = e.pointerType || 'mouse')}
      onPointerLeave={() => setTip(null)}
    >
      <svg
        ref={svgRef}
        className={svgClass}
        viewBox={`0 0 ${WIDTH} ${geo.height}`}
        role="img"
        aria-label={provinceCode ? 'Mapa de la red de Cercanías de la provincia' : 'Mapa de la red de alta velocidad de España'}
      >
        <rect className="map-sea" y={-1000} width={WIDTH} height={geo.height + 1000} onClick={clearFocus} />
        <g transform={transform.toString()}>
          <BaseLayer {...base} inset={geo.inset} withProvinces={false} />
          <ProvinceLayer
            provinceShapes={base.provinceShapes}
            activeCode={provinceCode}
            onEnter={(shape, e) =>
              pointerTip(e, {
                title: shape.name,
                meta: shape.hasNetwork
                  ? shape.code === provinceCode
                    ? 'Red de Cercanías'
                    : 'Pulsa para ver su red de Cercanías'
                  : 'Sin red de Cercanías',
              })
            }
            onLeave={() => setTip(null)}
            onPick={handleProvincePick}
          />
          <LineLayer
            shapes={lineShapes}
            activeIds={[selected?.line.id, preview?.line.id]}
            onHover={onHover}
            onClick={handleLineClick}
            k={k}
            capWidth={widths.base / unitPx}
            onTip={(line, e) =>
              pointerTip(e, {
                title: line.name,
                color: line.color,
                meta: `${line.types.join(' · ').replace('AVE Euromed', 'Euromed')} · ${line.stops.length} paradas`,
                status: line.status,
              })
            }
            onTipEnd={() => setTip(null)}
          />

          {selected && (
            <StopLayer
              shape={selected}
              k={k}
              mode="selected"
              width={widths.selected / unitPx}
              showLabels={!previewLabels}
              highlighted={highlightedStop}
              fontsReady={fontsReady}
              onActivate={(i) => handleStopActivate(selected.line, i)}
            />
          )}
          {preview && (
            <StopLayer
              shape={preview}
              k={k}
              mode="preview"
              width={widths.preview / unitPx}
              showLabels={previewLabels}
              highlighted={null}
              fontsReady={fontsReady}
              // Al pasar de la línea a una de sus paradas la previsualización se mantiene
              // (el «salir» de la línea y el «entrar» en la parada llegan en el mismo ciclo).
              onStopEnter={() => {
                onHover(preview.line.id);
                setStopHoverLine(preview.line.id);
              }}
              onStopLeave={() => {
                onHover(null);
                setStopHoverLine(null);
              }}
              onActivate={(i) => handleStopActivate(preview.line, i)}
            />
          )}

          {provinceCode && cerShapes.length > 0 && (
            <CercaniasLayer
              key={provinceCode}
              shapes={cerShapes}
              k={k}
              width={widths.cer}
              hoveredId={hoveredCerId}
              onHover={onHoverCer}
              onTip={(line, e) =>
                pointerTip(e, {
                  title: line.name,
                  color: line.color,
                  meta: [line.from, line.to].filter(Boolean).join(' – '),
                  status: line.status,
                })
              }
              onTipEnd={() => setTip(null)}
            />
          )}
          <LabelLayer {...base} k={k} hidden={provinceCode ? null : hiddenProvinceLabels} />
          {!provinceCode && !selected && !preview && <CityLabels groups={cityLabels} k={k} />}
        </g>
      </svg>

      <ZoomControls
        zoomBy={zoomBy}
        reset={() =>
          provinceCode
            ? fitBounds(base.provinceShapes.find((s) => s.code === provinceCode).bounds, { padding: 0.08, maxZoom: 10 })
            : reset()
        }
      />

      {province?.status === 'loading' && <CercaniasLoader />}

      {tip && (
        <div className={`map-tooltip${tip.flip ? ' is-flipped' : ''}`} style={{ left: tip.x, top: tip.y }}>
          <div className="tooltip-title">
            {tip.color && <span className="swatch" style={{ background: tip.color }} />}
            {tip.title}
          </div>
          {tip.meta && <div className="tooltip-meta">{tip.meta}</div>}
          {tip.status && tip.status.state !== 'unknown' && (
            <div className={`tooltip-status is-${tip.status.state}`}>
              {tip.status.state === 'active' ? 'En servicio ahora' : `Sin servicio ahora · ${tip.status.label}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const LineLayer = memo(function LineLayer({ shapes, activeIds, k, capWidth, onHover, onClick, onTip, onTipEnd }) {
  return (
    <g className="lines">
      {/* Cada línea con sus dos remates, en el mismo orden de dibujo: si se solapan, se tapan limpiamente. */}
      {shapes.map(({ line, d, ends }) => (
        <g key={line.id} className={`line-status${line.status?.state === 'inactive' ? ' is-inactive' : ''}`}>
          <g className={`line-group${activeIds.includes(line.id) ? ' is-active' : ''}`}>
            <path className="line" d={d} stroke={line.color} />
            {ends.map(([x, y], i) => (
              <circle key={i} className="line-cap" cx={x} cy={y} r={capWidth / 2 / k} style={{ fill: capColor(line.color) }} />
            ))}
          </g>
        </g>
      ))}
      {/* Zonas invisibles más anchas para que sea fácil pasar el ratón por encima */}
      <g className="hits">
        {shapes.map(({ line, d }) => (
          <path
            key={line.id}
            d={d}
            onPointerEnter={(e) => {
              onHover(line.id);
              onTip(line, e);
            }}
            onPointerMove={(e) => onTip(line, e)}
            onPointerLeave={() => {
              onHover(null);
              onTipEnd();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onClick(line);
            }}
          />
        ))}
      </g>
    </g>
  );
});

/**
 * Paradas de una línea (previsualizada o fijada) y sus etiquetas, colocadas sin solaparse.
 * En la línea fijada, cada parada se puede pulsar o elegir con el teclado (Tab + Enter/Espacio).
 */
function StopLayer({ shape, k, mode, width, showLabels, highlighted, fontsReady, onStopEnter, onStopLeave, onActivate }) {
  const { line, d, stops, ends } = shape;
  const last = stops.length - 1;
  const labels = useMemo(
    () => (showLabels ? placeLabels(stops, line.stops, k, [0, last, ...(highlighted != null ? [highlighted] : [])]) : null),
    // fontsReady fuerza a recolocar cuando ya se conoce el ancho real del texto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showLabels, stops, line.stops, k, highlighted, last, fontsReady],
  );
  const hasHighlight = mode === 'selected' && highlighted != null;

  return (
    <g className={`stop-layer stop-layer--${mode}${hasHighlight ? ' has-highlight' : ''}`}>
      <g pointerEvents="none">
        <path d={d} className="active-casing" />
        <path d={d} className="active-stroke" stroke={line.color} />
        {ends.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={width / 2 / k} style={{ fill: capColor(line.color) }} />
        ))}
      </g>

      {labels && (
        <g className="stop-labels" pointerEvents="none">
          {labels.map((l, i) =>
            l?.leader ? <line key={`l${i}`} x1={l.leader[0]} y1={l.leader[1]} x2={l.leader[2]} y2={l.leader[3]} strokeWidth={1 / k} /> : null,
          )}
          {labels.map((l, i) =>
            l ? (
              <text
                key={i}
                x={l.x}
                y={l.y}
                fontSize={LABEL_FONT_PX / k}
                strokeWidth={3 / k}
                className={`${i === highlighted && mode === 'selected' ? 'is-highlighted' : ''}${i === 0 || i === last ? ' is-terminal' : ''}`}
              >
                {line.stops[i]}
              </text>
            ) : null,
          )}
        </g>
      )}

      {stops.map(([x, y], i) => {
        const isEnd = i === 0 || i === last;
        const isHl = mode === 'selected' && i === highlighted;
        // Cabecera: remate del mismo diámetro que el trazo. Intermedia: anillo algo mayor que el trazo.
        const r = (isHl ? width * 1.05 : isEnd ? width / 2 : width * 0.55) / k;
        const activate = (e) => {
          e.stopPropagation();
          onActivate(i);
        };
        return (
          <g
            key={i}
            className={`stop${isEnd ? ' is-terminal' : ''}${isHl ? ' is-highlighted' : ''}`}
            transform={`translate(${x},${y})`}
            role={mode === 'selected' ? 'button' : undefined}
            tabIndex={mode === 'selected' ? 0 : undefined}
            aria-label={mode === 'selected' ? `Parada ${line.stops[i]}` : undefined}
            aria-pressed={mode === 'selected' ? isHl : undefined}
            onPointerEnter={onStopEnter}
            onPointerLeave={onStopLeave}
            onClick={activate}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate(e);
              }
            }}
          >
            {isHl && <circle className="stop-ring" r={r + 3.5 / k} stroke={line.color} strokeWidth={2 / k} />}
            <circle
              className="stop-dot"
              r={r}
              style={isEnd && !isHl ? { fill: capColor(line.color) } : isHl ? { fill: line.color } : undefined}
              stroke={isEnd || isHl ? 'none' : line.color}
              strokeWidth={1.5 / k}
            />
            <circle className="stop-hit" r={10 / k} />
          </g>
        );
      })}
    </g>
  );
}

/** Nombre de las ciudades principales (cabeceras con muchas líneas), solo en la vista general. */
function CityLabels({ groups, k }) {
  return (
    <g className="city-labels" pointerEvents="none" aria-hidden="true">
      {groups.map((g) => (
        <text key={g.city} x={g.x - 6 / k} y={g.y} fontSize={12 / k} strokeWidth={3.2 / k}>
          {g.city}
        </text>
      ))}
    </g>
  );
}

/** Red de Cercanías de una provincia: cada línea se traza de forma progresiva y las estaciones aparecen al final. */
function CercaniasLayer({ shapes, k, width, hoveredId, onHover, onTip, onTipEnd }) {
  const lastDelay = shapes.at(-1)?.delay ?? 0;
  return (
    <g className={`cer-network${hoveredId ? ' has-hover' : ''}`} style={{ '--draw-ms': `${DRAW_MS}ms` }}>
      {shapes.map(({ line, d, delay }) => (
        <g
          key={line.id}
          className={`cer-line${hoveredId === line.id ? ' is-hover' : ''}${line.status?.state === 'inactive' ? ' is-inactive' : ''}`}
          style={{ '--delay': `${delay}ms` }}
        >
          <path d={d} pathLength="1" className="cer-casing" strokeWidth={6 / k} />
          <path d={d} pathLength="1" className="cer-stroke" stroke={line.color ?? 'var(--accent)'} strokeWidth={width / k} />
          <path
            d={d}
            className="cer-hit"
            strokeWidth={14 / k}
            onPointerEnter={(e) => {
              onHover(line.id);
              onTip(line, e);
            }}
            onPointerMove={(e) => onTip(line, e)}
            onPointerLeave={() => {
              onHover(null);
              onTipEnd();
            }}
          />
        </g>
      ))}
      <g className="cer-stations" style={{ '--delay': `${lastDelay + DRAW_MS}ms` }} pointerEvents="none">
        {shapes.flatMap(({ line, ends }) =>
          ends.map(([x, y], i) => (
            <circle
              key={`cap-${line.id}-${i}`}
              cx={x}
              cy={y}
              r={width / 2 / k}
              style={{ fill: capColor(line.color) }}
              className={`cer-cap${line.status?.state === 'inactive' ? ' is-inactive' : ''}${hoveredId && hoveredId !== line.id ? ' is-dim' : ''}`}
            />
          )),
        )}
        {shapes.flatMap(({ line, stations }) =>
          stations.map((s, i) => (
            <circle
              key={`${line.id}-${i}`}
              cx={s.p[0]}
              cy={s.p[1]}
              r={(width * 0.55) / k}
              strokeWidth={1.3 / k}
              stroke={line.color ?? 'var(--accent)'}
              className={`${hoveredId && hoveredId !== line.id ? 'is-dim' : ''}${line.status?.state === 'inactive' ? ' is-inactive' : ''}`}
            />
          )),
        )}
      </g>
    </g>
  );
}

/** Mientras llega la red de Cercanías: un tren pequeño que va y viene por una vía. */
function CercaniasLoader() {
  return (
    <div className="cer-loader" role="status">
      <span className="cer-loader-track" aria-hidden="true">
        <span className="cer-loader-train" />
      </span>
      Cargando la red de Cercanías…
    </div>
  );
}
