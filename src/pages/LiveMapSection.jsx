import { useMemo, useState } from 'react';
import TrainMap from '../components/live/TrainMap.jsx';
import FilterPanel from '../components/live/FilterPanel.jsx';
import TrainCard from '../components/live/TrainCard.jsx';
import LineCard from '../components/live/LineCard.jsx';
import { useNetworkData } from '../lib/useNetworkData.js';
import { useAgo } from '../lib/useTrainMap.js';
import { inPlace } from '../lib/trainFilters.js';

/**
 * Sección «Mapa» de la portada: todos los trenes de España en tiempo real, con filtros
 * por tipo de servicio, red de Cercanías y provincia/ciudad (que acercan el mapa a la zona).
 */
export default function LiveMapSection({ live, onBook }) {
  const map = useNetworkData();
  const [service, setService] = useState('all');
  const [network, setNetwork] = useState(null);
  const [place, setPlace] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const ago = useAgo(live.fetchedAt);

  const trains = live.data?.trains ?? [];

  // Trenes de la zona elegida (red o lugar), antes de filtrar por tipo.
  const inArea = useMemo(
    () => trains.filter((t) => (!network || t.network === network) && inPlace(t, place)),
    [trains, network, place],
  );
  const serviceCounts = useMemo(() => {
    const c = { larga: 0, media: 0, corta: 0 };
    for (const t of inArea) c[t.service] = (c[t.service] ?? 0) + 1;
    return c;
  }, [inArea]);
  const shown = useMemo(() => inArea.filter((t) => service === 'all' || t.service === service), [inArea, service]);
  const selected = shown.find((t) => t.id === selectedId) ?? null;

  const selectedLine = (map.lines ?? []).find((l) => l.id === selectedLineId) ?? null;
  const selectTrain = (id) => {
    setSelectedId(id);
    if (id) setSelectedLineId(null);
  };
  const selectLine = (id) => {
    setSelectedLineId(id);
    if (id) setSelectedId(null);
  };
  /** Doble clic en una línea: compra de billete entre sus dos extremos. */
  const bookLine = (line) => onBook({ from: line.stops[0], to: line.stops.at(-1) });
  /** Doble clic en un tren: compra de billete para su recorrido (si se conoce). */
  const bookTrain = (train) => train.origin && onBook({ from: train.origin, to: train.destination });

  const focus = network ? { kind: 'network', id: network } : place;

  const chooseService = (id) => {
    setService(id);
    // Las redes de Cercanías solo tienen trenes de corta distancia.
    if (id !== 'all' && id !== 'corta') setNetwork(null);
  };
  const chooseNetwork = (id) => {
    setNetwork(id);
    setPlace(null);
    if (id) setService((s) => (s === 'all' ? s : 'corta'));
  };
  const choosePlace = (p) => {
    setPlace(p);
    setNetwork(null);
  };
  const resetAll = () => {
    setService('all');
    setNetwork(null);
    setPlace(null);
    setSelectedId(null);
    setSelectedLineId(null);
  };

  return (
    <section className="page live-section" id="mapa" aria-labelledby="mapa-title">
      <div className="page-head live-head">
        <p className="eyebrow">
          <span className="live-pulse" aria-hidden="true" /> En directo
          {live.fetchedAt && <span className="live-ago"> · actualizado {ago}</span>}
        </p>
        <h2 id="mapa-title" className="section-title">
          Todos los trenes de España, ahora mismo
        </h2>
        <p>
          Cada punto es un tren con su posición GPS real, actualizada cada {live.data?.pollSeconds ?? 20} segundos. Filtra por
          tipo, por red de Cercanías o por zona y el mapa se acercará solo. Haz doble clic en una línea para comprar
          un billete de ese trayecto.
        </p>
      </div>

      <div className="live-layout">
        <div className="card live-map-card">
          {(live.status === 'loading' || map.status === 'loading') && (
            <div className="map-status">Cargando trenes en directo…</div>
          )}
          {live.status === 'error' && (
            <div className="map-status">
              No llegan los datos en directo. Arranca el proyecto con <code>npm run dev</code> (web + servidor) y recarga.
            </div>
          )}
          {map.status === 'error' && <div className="map-status">No se ha podido cargar el mapa base.</div>}
          {live.status === 'ready' && map.status === 'ready' && (
            <>
              <TrainMap
                provinces={map.provinces}
                countries={map.countries}
                tracks={map.lines}
                trains={shown}
                focus={focus}
                selectedId={selected?.id ?? null}
                onSelect={selectTrain}
                selectedLineId={selectedLine?.id ?? null}
                onSelectLine={selectLine}
                onBookLine={bookLine}
                onBookTrain={bookTrain}
              />
              {selected && (
                <TrainCard
                  train={selected}
                  onClose={() => setSelectedId(null)}
                  onBook={selected.origin ? () => bookTrain(selected) : null}
                />
              )}
              {selectedLine && (
                <LineCard line={selectedLine} onClose={() => setSelectedLineId(null)} onBook={() => bookLine(selectedLine)} />
              )}
              {!shown.length && <div className="map-empty-note">No hay trenes de este tipo en la zona ahora mismo.</div>}
            </>
          )}
        </div>

        {map.status === 'ready' && (
          <FilterPanel
            provinces={map.provinces}
            service={service}
            network={network}
            place={place}
            serviceCounts={serviceCounts}
            networkCounts={live.data?.facets.network ?? {}}
            totalShown={shown.length}
            onService={chooseService}
            onNetwork={chooseNetwork}
            onPlace={choosePlace}
            onReset={resetAll}
          />
        )}
      </div>

      <footer className="sources">
        Posiciones GPS:{' '}
        <a href="https://data.renfe.com/" target="_blank" rel="noreferrer">
          Renfe Data · GTFS-Realtime
        </a>
        . Algunos trenes pueden tardar unos minutos en aparecer o desaparecer del mapa.
      </footer>
    </section>
  );
}
