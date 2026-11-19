import PlaceSearch from './PlaceSearch.jsx';
import { CITIES, NETWORKS, QUICK_PLACES, SERVICES } from '../../lib/trainFilters.js';

/**
 * Panel lateral del mapa en directo:
 *  1. Tipo de tren (larga, media, corta distancia)
 *  2. Red de Cercanías (Madrid, Barcelona, Valencia, Euskadi…)
 *  3. Provincia o ciudad
 * Elegir una red o un lugar acerca el mapa a esa zona.
 */
export default function FilterPanel({
  provinces,
  service,
  network,
  place,
  serviceCounts,
  networkCounts,
  totalShown,
  onService,
  onNetwork,
  onPlace,
  onReset,
}) {
  const hasFilters = service !== 'all' || network || place;
  const totalForServices = Object.values(serviceCounts).reduce((a, b) => a + b, 0);

  return (
    <aside className="live-panel card" aria-label="Filtros del mapa">
      <div className="live-panel-head">
        <p className="live-panel-count">
          <strong>{totalShown}</strong> {totalShown === 1 ? 'tren' : 'trenes'} en el mapa
        </p>
        <button type="button" className="link-button" onClick={onReset} disabled={!hasFilters}>
          Ver toda España
        </button>
      </div>

      <fieldset className="filter-group">
        <legend>Tipo de tren</legend>
        <div className="service-buttons">
          <button
            type="button"
            className={`service-btn${service === 'all' ? ' is-active' : ''}`}
            aria-pressed={service === 'all'}
            onClick={() => onService('all')}
          >
            <span className="service-btn-label">Todos</span>
            <span className="service-btn-count">{totalForServices}</span>
          </button>
          {SERVICES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`service-btn${service === s.id ? ' is-active' : ''}`}
              aria-pressed={service === s.id}
              onClick={() => onService(s.id)}
              title={s.hint}
            >
              <span className="service-btn-label">
                <span className={`svc-dot svc-dot--${s.id}`} />
                {s.label.replace(' distancia', '')}
              </span>
              <span className="service-btn-count">{serviceCounts[s.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <p className="filter-hint">
          {service === 'all' ? 'Larga: AVE, AVLO, Intercity · Media: AVANT, Regional · Corta: Cercanías' : SERVICES.find((s) => s.id === service)?.hint}
        </p>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Cercanías</legend>
        <div className="network-grid">
          {NETWORKS.map((n) => {
            const count = networkCounts[n.id] ?? 0;
            const active = network === n.id;
            return (
              <button
                key={n.id}
                type="button"
                className={`network-btn${active ? ' is-active' : ''}`}
                aria-pressed={active}
                disabled={!count && !active}
                onClick={() => onNetwork(active ? null : n.id)}
              >
                <span className="network-btn-name">{n.label}</span>
                <span className="network-btn-meta">
                  {n.sub ? `${n.sub} · ` : ''}
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Provincia o ciudad</legend>
        <PlaceSearch provinces={provinces} onPick={onPlace} />
        {place ? (
          <div className="place-chip">
            <span>
              <span className="place-kind">{place.kind === 'city' ? 'Ciudad' : 'Provincia'}</span> {place.name}
            </span>
            <button type="button" onClick={() => onPlace(null)} aria-label={`Quitar ${place.name}`}>
              ×
            </button>
          </div>
        ) : (
          <div className="quick-places">
            {QUICK_PLACES.map((name) => (
              <button
                key={name}
                type="button"
                className="quick-place"
                onClick={() => onPlace({ kind: 'city', ...CITIES.find((c) => c.name === name) })}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </fieldset>
    </aside>
  );
}
