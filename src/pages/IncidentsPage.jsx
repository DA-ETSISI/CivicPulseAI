import { useEffect, useMemo, useState } from 'react';
import LiveMap from '../components/incidents/LiveMap.jsx';
import StatusSummary from '../components/incidents/StatusSummary.jsx';
import TrainStatusList from '../components/incidents/TrainStatusList.jsx';
import TrainDetail from '../components/incidents/TrainDetail.jsx';
import AlertsPanel from '../components/incidents/AlertsPanel.jsx';
import { STATUSES, useLiveTrains } from '../lib/useLiveTrains.js';
import { useTrainDetail } from '../lib/useTrainDetail.js';
import { loadCercaniasTracks, useNetworkData } from '../lib/useNetworkData.js';

const KINDS = [
  { id: 'all', label: 'Todos' },
  { id: 'ld', label: 'Larga y media distancia' },
  { id: 'cer', label: 'Cercanías' },
];

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** «Hace 12 s», actualizado cada segundo. */
function useAgo(timestamp) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!timestamp) return '';
  const s = Math.max(0, Math.round((now - timestamp) / 1000));
  return s < 60 ? `hace ${s} s` : `hace ${Math.floor(s / 60)} min`;
}

/** Sección «Incidencias»: trenes en tiempo real, seguimiento de un tren, retrasos y avisos. */
export default function IncidentsPage() {
  const live = useLiveTrains();
  const map = useNetworkData();
  const [statuses, setStatuses] = useState(() => new Set(STATUSES.map((s) => s.id)));
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const [onlyLate, setOnlyLate] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [follow, setFollow] = useState(false);
  const [cerTracks, setCerTracks] = useState([]);
  const detail = useTrainDetail(selectedId);
  const ago = useAgo(live.fetchedAt);

  useEffect(() => {
    loadCercaniasTracks().then(setCerTracks, () => setCerTracks([]));
  }, []);

  const select = (id) => {
    setSelectedId(id);
    setFollow(Boolean(id));
  };

  const all = live.data?.trains ?? [];
  const byKind = useMemo(() => all.filter((t) => kind === 'all' || t.kind === kind), [all, kind]);
  const counts = useMemo(() => {
    const c = {};
    for (const t of byKind) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [byKind]);
  const lateFrom = live.data?.rules.officialDelayMin ?? 5;
  const lateCount = useMemo(() => byKind.filter((t) => t.officialDelayMin >= lateFrom).length, [byKind, lateFrom]);
  const shown = useMemo(() => {
    const q = normalize(query.trim());
    return byKind.filter(
      (t) =>
        t.id === selectedId ||
        (statuses.has(t.status) &&
          (!onlyLate || t.officialDelayMin >= lateFrom) &&
          (!q || normalize(`${t.label} ${t.number} ${t.origin ?? ''} ${t.destination ?? ''} ${t.stopName ?? ''}`).includes(q))),
    );
  }, [byKind, statuses, query, onlyLate, lateFrom, selectedId]);
  const selectedTrain = all.find((t) => t.id === selectedId) ?? null;

  const toggleStatus = (id) =>
    setStatuses((prev) => {
      // Primer clic: ver solo ese estado. Siguientes: añadir o quitar.
      if (prev.size === STATUSES.length) return new Set([id]);
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next.size ? next : new Set(STATUSES.map((s) => s.id));
    });

  const rules = live.data?.rules;
  const source = live.data?.source;

  return (
    <section className="page" id="incidencias">
      <div className="page-head incidents-head">
        <div>
          <h1>Incidencias en tiempo real</h1>
          <p>
            Dónde está cada tren ahora mismo, cuáles van con retraso y qué avisos hay en la red. Pulsa un tren para seguir
            su recorrido en directo.
          </p>
        </div>
        <div className={`live-badge${live.error ? ' is-error' : ''}`} role="status">
          <span className="live-pulse" aria-hidden="true" />
          {live.status === 'loading' && 'Conectando…'}
          {live.status === 'error' && 'Sin conexión con el servidor'}
          {live.status === 'ready' && (live.error ? `Reintentando · datos de ${ago}` : `En directo · actualizado ${ago}`)}
        </div>
      </div>

      {live.status === 'error' && (
        <div className="card placeholder">
          <h2>No hay conexión con el servidor de datos</h2>
          <p>
            Arranca el proyecto con <code>npm run dev</code> (inicia la web y el servidor a la vez).
          </p>
          <button type="button" className="btn" onClick={live.refresh}>
            Reintentar
          </button>
        </div>
      )}

      {live.status === 'ready' && (
        <>
          <StatusSummary counts={counts} active={statuses} onToggle={toggleStatus} />

          <div className="official-strip">
            <button
              type="button"
              className={`official-stat${onlyLate ? ' is-on' : ''}`}
              aria-pressed={onlyLate}
              onClick={() => setOnlyLate((v) => !v)}
            >
              <strong>{lateCount}</strong> trenes con retraso oficial de {lateFrom} min o más
              <span className="official-stat-action">{onlyLate ? 'Ver todos' : 'Ver solo estos'}</span>
            </button>
            <span className="official-stat is-static">
              <strong>{live.data.counts.canceled}</strong> trenes cancelados hoy
            </span>
            <span className="official-stat is-static">
              <strong>{live.data.alerts.length}</strong> avisos activos
            </span>
          </div>

          {source && !source.ok && (
            <p className="notice">Ahora mismo no llegan datos nuevos de la fuente. Se muestran los últimos conocidos.</p>
          )}

          <div className="card map-card">
            <div className="map-toolbar live-toolbar">
              <div className="chips" role="radiogroup" aria-label="Tipo de servicio">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    role="radio"
                    aria-checked={kind === k.id}
                    className={`chip${kind === k.id ? ' is-on' : ''}`}
                    onClick={() => setKind(k.id)}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <label className="search live-search">
                <span className="visually-hidden">Buscar tren o estación</span>
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                  <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <input type="search" placeholder="Nº de tren, línea o estación" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
            </div>

            <div className="map-layout">
              <div className="map-area">
                {map.status === 'ready' ? (
                  <LiveMap
                    provinces={map.provinces}
                    countries={map.countries}
                    network={kind === 'cer' ? [] : map.lines}
                    cerTracks={kind === 'ld' ? [] : cerTracks}
                    trains={shown}
                    selected={selectedId ? { id: selectedId, train: selectedTrain, detail: detail.data } : null}
                    follow={follow}
                    onSelect={select}
                  />
                ) : (
                  <div className="map-status">Cargando mapa…</div>
                )}
              </div>
              <aside className="panel" aria-label={selectedId ? 'Seguimiento del tren' : 'Listado de trenes'}>
                {selectedId ? (
                  <div className="panel-scroll">
                    <TrainDetail
                      train={selectedTrain}
                      detail={detail.data}
                      loading={detail.status === 'loading'}
                      follow={follow}
                      onToggleFollow={() => setFollow((f) => !f)}
                      onClose={() => select(null)}
                    />
                  </div>
                ) : (
                  <>
                    <h3 className="group-title live-count">
                      Trenes <span>{shown.length}</span>
                    </h3>
                    <div className="panel-scroll">
                      <TrainStatusList trains={shown} selectedId={selectedId} onSelect={select} />
                    </div>
                  </>
                )}
              </aside>
            </div>
          </div>

          <AlertsPanel alerts={live.data.alerts} query={query} />

          {rules && (
            <div className="card how-it-works">
              <h2>¿Cómo detectamos un retraso?</h2>
              <p>
                Cada {live.data.pollSeconds} segundos recibimos la posición GPS de todos los trenes de Renfe. Con ella
                deducimos su estado: <strong>parado</strong> si está a menos de 400 m de una estación, <strong>en camino</strong>{' '}
                si le queda menos de 1,5 km para la siguiente y <strong>en movimiento</strong> si va entre dos estaciones.
              </p>
              <p>
                Si un tren figura <strong>en movimiento</strong> pero su GPS no se ha desplazado más de {rules.stillMeters} m durante{' '}
                {rules.delayAfterMin} minutos, lo marcamos como <strong>retraso</strong>. Es una estimación: un GPS que deja de
                actualizarse también puede parecer un tren detenido, por eso descartamos los trenes cuya posición está
                desactualizada. Al arrancar el servidor hacen falta unos minutos de observación.
              </p>
              <p>
                Junto a esta estimación mostramos el <strong>retraso oficial</strong> que comunica Renfe para cada tren, los
                trenes cancelados y los avisos de servicio (incidencias, obras, accesibilidad…).
              </p>
              <p className="summary-note">
                Fuente: <a href="https://radardetrenes.com" target="_blank" rel="noreferrer">RadarDeTrenes</a>, que reúne los
                datos abiertos de Renfe (posiciones, retrasos y avisos) y de ADIF.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
