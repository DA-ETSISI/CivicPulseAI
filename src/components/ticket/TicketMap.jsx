import { useEffect, useMemo, useRef } from 'react';
import { WIDTH, buildBase, buildGeometry } from '../../lib/mapGeometry.js';
import { useMapZoom } from '../../lib/useMapZoom.js';
import { placeLabels } from '../../lib/mapLabels.js';
import { madridEpoch } from '../../lib/myTicket.js';
import { useSvgScale } from '../RailMap.jsx';
import { BaseLayer, LabelLayer, ZoomControls } from '../MapBase.jsx';

/** Tamaño (px de pantalla) de las etiquetas: paradas intermedias y estaciones clave (origen, transbordo, destino). */
const STOP_FONT_PX = 13;
const KEY_FONT_PX = 15;

/**
 * Hasta dónde ha llegado el tren de un tramo a la hora `now` (con su retraso).
 * Devuelve { passed: índice de la última parada pasada (-1 si no ha salido), pos: [x, y] | null (en marcha) }.
 */
function legProgress(leg, points, date, now) {
  if (leg.cancelled) return { passed: -1, pos: null };
  const delay = Math.max(0, leg.delay ?? 0) * 60_000;
  const at = (min) => madridEpoch(date, min) + delay;
  const { stops } = leg;
  if (now < at(stops[0].dep)) return { passed: -1, pos: null };
  for (let j = 0; j < stops.length - 1; j++) {
    const dep = at(stops[j].dep);
    const arr = at(stops[j + 1].arr);
    if (now < dep) return { passed: j, pos: points[j] }; // parado en la estación
    if (now < arr) {
      const f = (now - dep) / Math.max(1, arr - dep);
      const [x0, y0] = points[j];
      const [x1, y1] = points[j + 1];
      return { passed: j, pos: [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f] };
    }
  }
  return { passed: stops.length - 1, pos: null }; // tramo terminado
}

const polyline = (pts) => (pts.length > 1 ? `M${pts.map(([x, y]) => `${x},${y}`).join('L')}` : null);

/**
 * Mapa con el trayecto del billete. Lo ya recorrido va en el color de cada tren y lo que falta en gris;
 * un punto marca dónde va el tren (posición estimada con el horario, el retraso y la hora actual o simulada).
 * Se rotulan todas las paradas sin solaparse (las intermedias que no caben aparecen al acercar el zoom);
 * las ya pasadas, en tono apagado.
 */
export default function TicketMap({ provinces, countries, stations, itinerary, tl, now }) {
  const svgRef = useRef(null);
  const geo = useMemo(() => buildGeometry(provinces, countries), [provinces, countries]);
  const base = useMemo(() => buildBase(provinces, countries, geo), [provinces, countries, geo]);
  const { transform, zoomBy, reset, fitBounds } = useMapZoom(svgRef, geo.height);
  const unitPx = useSvgScale(svgRef, geo.height);
  const k = transform.k;
  const ks = k * unitPx; // píxeles de pantalla por unidad del mapa: las etiquetas se miden en px reales

  const legs = useMemo(
    () =>
      itinerary.legs.map((leg) => {
        // Las paradas de la demo traen sus coordenadas; las reales se buscan en los horarios.
        const coords = leg.stops.map((s) => (s.lon != null ? [s.lon, s.lat] : [stations[s.id].lon, stations[s.id].lat]));
        return {
          leg,
          d: geo.path({ type: 'LineString', coordinates: coords }),
          points: coords.map((c) => geo.projection(c)),
          bounds: geo.path.bounds({ type: 'LineString', coordinates: coords }),
        };
      }),
    [itinerary, stations, geo],
  );

  // Todas las paradas del viaje, una vez cada una (el final de un tramo y el inicio del siguiente son la misma).
  const allStops = useMemo(() => {
    const list = [];
    legs.forEach(({ leg, points }, i) => {
      leg.stops.forEach((s, j) => {
        if (i > 0 && j === 0 && leg.fromId === itinerary.legs[i - 1].toId) return;
        const isFirst = i === 0 && j === 0;
        const isLast = i === legs.length - 1 && j === leg.stops.length - 1;
        const kind = isFirst || isLast ? 'end' : j === 0 || j === leg.stops.length - 1 ? 'transfer' : 'stop';
        list.push({ p: points[j], name: s.name, kind, leg: i, index: j });
      });
    });
    return list;
  }, [legs, itinerary]);

  // Zona visible del mapa (unidades del mapa), para que ninguna etiqueta quede cortada en el borde.
  const { x: tx, y: ty } = transform;
  const labels = useMemo(() => {
    const idx = allStops.map((_, i) => i);
    const bounds = { x0: -tx / k, y0: -ty / k, x1: (WIDTH - tx) / k, y1: (geo.height - ty) / k };
    return placeLabels(
      allStops.map((s) => s.p),
      allStops.map((s) => s.name),
      ks,
      idx.filter((i) => allStops[i].kind !== 'stop'),
      {
        sizes: allStops.map((s) => (s.kind === 'stop' ? STOP_FONT_PX : KEY_FONT_PX)),
        optional: new Set(idx.filter((i) => allStops[i].kind === 'stop')),
        bounds,
      },
    );
  }, [allStops, ks, k, tx, ty, geo.height]);

  // Progreso de cada tramo con la hora actual (o la simulada).
  const progress = useMemo(
    () => legs.map(({ points }, i) => legProgress(tl.legs[i], points, itinerary.date, now)),
    [legs, tl, itinerary.date, now],
  );
  const train = progress.find((p) => p.pos)?.pos ?? null;
  const isPassed = (s) => progress[s.leg].passed >= s.index || progress.slice(s.leg + 1).some((p) => p.passed >= 0);

  // Encuadre del viaje al cargar o cambiar de billete.
  const tripKey = itinerary.legs.map((l) => `${l.number}:${l.fromId}-${l.toId}`).join('|');
  useEffect(() => {
    const [[x0, y0], [x1, y1]] = legs.reduce(
      ([[a, b], [c, d]], { bounds: [[e, f], [g, h]] }) => [
        [Math.min(a, e), Math.min(b, f)],
        [Math.max(c, g), Math.max(d, h)],
      ],
      [
        [Infinity, Infinity],
        [-Infinity, -Infinity],
      ],
    );
    fitBounds(
      [
        [x0, y0],
        [x1, y1],
      ],
      { padding: 0.18, maxZoom: 7, duration: 900 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey, fitBounds]);

  return (
    <div className="map-frame ticket-map">
      <svg ref={svgRef} className="map-svg" viewBox={`0 0 ${WIDTH} ${geo.height}`} role="img" aria-label="Mapa con el trayecto de tu billete">
        <rect className="map-sea" y={-1000} width={WIDTH} height={geo.height + 1000} />
        <g transform={transform.toString()}>
          <BaseLayer {...base} inset={geo.inset} />
          <LabelLayer {...base} k={k} />
          <g className="ticket-legs-map" pointerEvents="none">
            {/* Lo que falta, en gris tenue */}
            {legs.map(({ d }, i) => (
              <path key={`r${i}`} d={d} className="ticket-rest" />
            ))}
            {/* Lo ya recorrido, en el color de cada tren */}
            {legs.map(({ points }, i) => {
              const p = progress[i];
              if (p.passed < 0) return null;
              const d = polyline([...points.slice(0, p.passed + 1), ...(p.pos ? [p.pos] : [])]);
              return d ? (
                <g key={`t${i}`} style={{ '--leg': `var(--leg-${i % 4})` }}>
                  <path d={d} className="ticket-casing" />
                  <path d={d} className="ticket-stroke" />
                </g>
              ) : null;
            })}
            {allStops.map((s, i) =>
              s.kind === 'stop' ? (
                <circle
                  key={`s${i}`}
                  cx={s.p[0]}
                  cy={s.p[1]}
                  r={2.6 / k}
                  strokeWidth={1.4 / k}
                  className={`ticket-stop${isPassed(s) ? ' is-passed' : ''}`}
                  style={{ '--leg': `var(--leg-${s.leg % 4})` }}
                />
              ) : (
                <circle key={`k${i}`} cx={s.p[0]} cy={s.p[1]} r={(s.kind === 'transfer' ? 6 : 5) / k} strokeWidth={2.2 / k} className={`ticket-key is-${s.kind}`} />
              ),
            )}
            {train && (
              <g className="ticket-train" transform={`translate(${train[0]},${train[1]})`}>
                <circle r={11 / k} className="ticket-train-halo" />
                <circle r={6 / k} strokeWidth={2.5 / k} className="ticket-train-dot" />
              </g>
            )}
          </g>
          <g className="stop-labels ticket-labels" pointerEvents="none">
            {labels.map((l, i) =>
              l?.leader ? <line key={`l${i}`} x1={l.leader[0]} y1={l.leader[1]} x2={l.leader[2]} y2={l.leader[3]} strokeWidth={1 / ks} /> : null,
            )}
            {labels.map((l, i) => {
              if (!l) return null;
              const s = allStops[i];
              const cls = `${s.kind === 'transfer' ? 'is-highlighted' : s.kind === 'end' ? 'is-terminal' : ''}${isPassed(s) ? ' is-passed' : ''}`;
              return (
                <text key={i} x={l.x} y={l.y} fontSize={(s.kind === 'stop' ? STOP_FONT_PX : KEY_FONT_PX) / ks} strokeWidth={3 / ks} className={cls}>
                  {s.name}
                </text>
              );
            })}
          </g>
        </g>
      </svg>
      <ZoomControls zoomBy={zoomBy} reset={() => reset()} />
    </div>
  );
}
