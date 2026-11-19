import { useCallback, useEffect, useMemo, useState } from 'react';
import RailMap from '../components/RailMap.jsx';
import CategoryFilter from '../components/CategoryFilter.jsx';
import LinePanel from '../components/LinePanel.jsx';
import CercaniasPanel from '../components/CercaniasPanel.jsx';
import { useNetworkData } from '../lib/useNetworkData.js';
import { loadCercanias, useProvinceCercanias } from '../lib/useCercanias.js';
import { CATEGORIES } from '../lib/categories.js';
import { lineColor } from '../lib/colors.js';

/**
 * Rutas: mapa de la red de alta velocidad (con filtros por servicio y listado por comunidades)
 * y, al pulsar una provincia, su red de Cercanías.
 */
export default function MapPage({ theme, id = 'mapa' }) {
  const data = useNetworkData();
  const [visible, setVisible] = useState(() => new Set(CATEGORIES.map((c) => c.id)));
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [highlightedStop, setHighlightedStop] = useState(null);
  const [provinceCode, setProvinceCode] = useState(null);
  const [hoveredCerId, setHoveredCerId] = useState(null);
  const cercanias = useProvinceCercanias(provinceCode);

  // Cada línea tiene su color; en modo oscuro se aclara.
  const lines = useMemo(
    () => (data.lines ?? []).map((line, i) => ({ ...line, color: lineColor(i, theme) })),
    [data.lines, theme],
  );
  const shown = useMemo(() => lines.filter((l) => l.types.some((t) => visible.has(t))), [lines, visible]);
  const counts = useMemo(() => {
    const c = {};
    for (const l of lines) for (const t of l.types) c[t] = (c[t] ?? 0) + 1;
    return c;
  }, [lines]);
  const selected = shown.find((l) => l.id === selectedId) ?? null;
  const provinceName = data.provinces?.features.find((f) => f.properties.code === provinceCode)?.properties.name;

  const toggle = (type) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else next.add(type);
      return next;
    });

  // Pulsar de nuevo la misma línea la deselecciona. Al cambiar de línea se quita el resalte de parada.
  const select = useCallback((lineId) => {
    setSelectedId((cur) => (lineId && cur === lineId ? null : lineId));
    setHighlightedStop(null);
  }, []);

  // Pulsar una parada la resalta (y fija su línea si no lo estaba); volver a pulsarla quita el resalte.
  const pickStop = useCallback(
    (lineId, index) => {
      if (lineId !== selectedId) {
        setSelectedId(lineId);
        setHighlightedStop(index);
      } else {
        setHighlightedStop((cur) => (cur === index ? null : index));
      }
    },
    [selectedId],
  );

  const enterProvince = useCallback((code) => {
    setSelectedId(null);
    setHighlightedStop(null);
    setHoveredId(null);
    setHoveredCerId(null);
    setProvinceCode(code);
  }, []);
  const leaveProvince = useCallback(() => {
    setHoveredCerId(null);
    setProvinceCode(null);
  }, []);

  // La red de Cercanías se descarga en segundo plano para que el primer vuelo no espere.
  useEffect(() => {
    if (data.status !== 'ready') return undefined;
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500));
    const handle = idle(() => loadCercanias().catch(() => {}));
    return () => (window.cancelIdleCallback ?? clearTimeout)(handle);
  }, [data.status]);

  // Escape sale de la provincia o cierra la ficha de la ruta.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (provinceCode) leaveProvince();
      else if (selectedId) select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [provinceCode, selectedId, leaveProvince, select]);

  return (
    <section className="page routes-page" id={id}>
      <div className="page-head">
        <h1>La alta velocidad en España, de un vistazo</h1>
        <p>
          Pasa el ratón por una ruta para resaltarla o púlsala para ver sus paradas. Pulsa una provincia para ver su red de
          Cercanías. Acércate con la rueda del ratón o pellizcando la pantalla.
        </p>
      </div>

      <div className="routes-layout">
        <div className="card map-card">
          <div className="map-toolbar">
            {provinceCode ? (
              <nav className="crumbs" aria-label="Estás en">
                <button type="button" className="crumb" onClick={leaveProvince}>
                  Alta velocidad
                </button>
                <span aria-hidden="true">/</span>
                <span className="crumb is-current" aria-current="page">
                  Cercanías de {provinceName}
                </span>
              </nav>
            ) : (
              <CategoryFilter visible={visible} counts={counts} onToggle={toggle} />
            )}
          </div>

          <div className="map-area">
            {data.status === 'loading' && <div className="map-status">Cargando la red ferroviaria…</div>}
            {data.status === 'error' && (
              <div className="map-status">No se han podido cargar los datos. Ejecuta «npm run data» y recarga.</div>
            )}
            {data.status === 'ready' && (
              <RailMap
                provinces={data.provinces}
                countries={data.countries}
                lines={shown}
                fitLines={lines}
                hoveredId={hoveredId}
                selectedId={selected?.id ?? null}
                highlightedStop={highlightedStop}
                onHover={setHoveredId}
                onSelect={select}
                onStopPick={pickStop}
                province={provinceCode ? { code: provinceCode, status: cercanias.status, lines: cercanias.lines } : null}
                hoveredCerId={hoveredCerId}
                onHoverCer={setHoveredCerId}
                onProvincePick={enterProvince}
              />
            )}
          </div>
        </div>

        {data.status === 'ready' && (
          <aside className="card side-card" aria-label={provinceCode ? `Cercanías de ${provinceName}` : 'Rutas por comunidad autónoma'}>
            {provinceCode ? (
              <CercaniasPanel
                provinceName={provinceName}
                state={cercanias}
                hoveredId={hoveredCerId}
                onHover={setHoveredCerId}
                onBack={leaveProvince}
              />
            ) : (
              <LinePanel
                lines={shown}
                selected={selected}
                hoveredId={hoveredId}
                highlightedStop={highlightedStop}
                onHover={setHoveredId}
                onSelect={select}
                onStopPick={pickStop}
              />
            )}
          </aside>
        )}
      </div>

      {data.status === 'ready' && (
        <p className="track-note">
          Trazado real de la vía en <span className="num">{lines.filter((l) => l.realTrack).length}</span> de{' '}
          <span className="num">{lines.length}</span> rutas. El resto se dibuja uniendo sus estaciones y se completa a medida
          que circulan los trenes.
        </p>
      )}

      {data.status === 'ready' && (
        <footer className="sources">
          Datos abiertos:{' '}
          {data.meta.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ' · '}
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.name}
              </a>
            </span>
          ))}
          {' · '}
          <a href="https://data.renfe.com/dataset/horarios-cercanias" target="_blank" rel="noreferrer">
            Renfe Data · GTFS Cercanías y Rodalies
          </a>
          . Actualizado el {new Date(data.meta.generatedAt).toLocaleDateString('es-ES')}.
        </footer>
      )}
    </section>
  );
}
