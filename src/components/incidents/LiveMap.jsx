import { memo, useMemo, useRef, useState } from 'react';
import { WIDTH, buildBase, buildGeometry } from '../../lib/mapGeometry.js';
import { useMapZoom } from '../../lib/useMapZoom.js';
import { STATUS_BY_ID } from '../../lib/useLiveTrains.js';
import { BaseLayer, LabelLayer, ZoomControls } from '../MapBase.jsx';

/** Mapa con la posición GPS de cada tren, coloreada según su estado. */
export default function LiveMap({ provinces, countries, network, trains, selectedId, onSelect }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  const geo = useMemo(() => buildGeometry(provinces, countries), [provinces, countries]);
  const base = useMemo(() => buildBase(provinces, countries, geo), [provinces, countries, geo]);
  const tracks = useMemo(
    () => network.map((l) => ({ id: l.id, d: geo.path({ type: 'MultiLineString', coordinates: l.coords }) })),
    [network, geo],
  );
  const { transform, zoomBy, reset } = useMapZoom(svgRef, geo.height);
  const k = transform.k;

  // Los retrasos se dibujan los últimos para que queden por encima.
  const dots = useMemo(
    () =>
      trains
        .map((t) => {
          const p = geo.projection([t.lon, t.lat]);
          return p ? { train: t, x: p[0], y: p[1] } : null;
        })
        .filter(Boolean)
        .reverse(),
    [trains, geo],
  );

  const showTip = (dot) => (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    setHover({ train: dot.train, x, y: event.clientY - rect.top, flip: x > rect.width * 0.62 });
  };

  return (
    <div className="map-frame" onPointerLeave={() => setHover(null)}>
      <svg ref={svgRef} className="map-svg" viewBox={`0 0 ${WIDTH} ${geo.height}`} role="img" aria-label="Mapa de trenes en tiempo real">
        <rect className="map-sea" y={-1000} width={WIDTH} height={geo.height + 1000} onClick={() => onSelect(null)} />
        <g transform={transform.toString()}>
          <BaseLayer {...base} inset={geo.inset} />
          <Tracks tracks={tracks} />
          <LabelLayer {...base} k={k} />
          <g className="train-dots">
            {dots.map((dot) => {
              const { train } = dot;
              const selected = train.id === selectedId;
              const r = (train.status === 'delay' ? 6 : train.kind === 'ld' ? 4.6 : 3.4) / k;
              return (
                <g key={train.id} transform={`translate(${dot.x},${dot.y})`}>
                  {train.status === 'delay' && <circle className="dot-pulse" r={r} strokeWidth={2 / k} />}
                  <circle
                    className={`train-dot train-dot--${train.status}${selected ? ' is-selected' : ''}`}
                    r={selected ? r * 1.6 : r}
                    strokeWidth={(selected ? 2.5 : 1.2) / k}
                    onPointerEnter={showTip(dot)}
                    onPointerMove={showTip(dot)}
                    onPointerLeave={() => setHover(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(train.id);
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
        {['delay', 'moving', 'incoming', 'stopped'].map((id) => (
          <span key={id}>
            <span className={`status-dot status-dot--${id}`} />
            {STATUS_BY_ID[id].label}
          </span>
        ))}
      </div>

      {hover && (
        <div className={`map-tooltip${hover.flip ? ' is-flipped' : ''}`} style={{ left: hover.x, top: hover.y }}>
          <div className="tooltip-title">
            <span className={`status-dot status-dot--${hover.train.status}`} />
            {hover.train.label}
          </div>
          <div className="tooltip-meta">
            {STATUS_BY_ID[hover.train.status].label}
            {hover.train.stopName && ` · ${hover.train.status === 'stopped' ? 'en' : 'hacia'} ${hover.train.stopName}`}
          </div>
          {hover.train.officialDelayMin > 0 && (
            <div className="tooltip-meta">Retraso oficial Renfe: {hover.train.officialDelayMin} min</div>
          )}
          {hover.train.status === 'delay' && (
            <div className="tooltip-meta">Sin moverse desde hace {hover.train.stillMinutes} min</div>
          )}
        </div>
      )}
    </div>
  );
}

const Tracks = memo(function Tracks({ tracks }) {
  return (
    <g className="live-tracks" pointerEvents="none">
      {tracks.map((t) => (
        <path key={t.id} d={t.d} />
      ))}
    </g>
  );
});
