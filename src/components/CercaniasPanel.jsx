import { IconArrowLeft } from './icons.jsx';

/** Panel en modo provincia: las líneas de Cercanías (o Rodalies) que tienen estaciones en ella. */
export default function CercaniasPanel({ provinceName, state, hoveredId, onHover, onBack }) {
  const networks = [...new Set(state.lines.map((l) => l.nucleo))];
  const isRodalies = networks.some((n) => n.startsWith('Rodalies'));

  return (
    <div className="cer-panel">
      <button type="button" className="back" onClick={onBack}>
        <IconArrowLeft size={16} />
        Volver a alta velocidad
      </button>

      <div className="cer-panel-head">
        <h2>{provinceName}</h2>
        {state.status === 'ready' && (
          <p>
            {state.lines.length} {state.lines.length === 1 ? 'línea' : 'líneas'} de {isRodalies ? 'Rodalies' : 'Cercanías'}
            {networks.length > 0 && ` · ${networks.join(', ')}`}
          </p>
        )}
      </div>

      <div className="panel-scroll">
        {state.status === 'loading' && <p className="empty">Preparando las líneas…</p>}
        {state.status === 'error' && (
          <div className="empty-state">
            <p className="empty-title">No hemos podido cargar la red de Cercanías.</p>
            <p>Comprueba que existe public/data/cercanias.json (se genera con «npm run data») y vuelve a intentarlo.</p>
          </div>
        )}
        {state.status === 'ready' && (
          <ul className="cer-lines">
            {state.lines.map((l) => (
              <li key={l.id}>
                <div
                  className={`cer-item${hoveredId === l.id ? ' is-hover' : ''}`}
                  tabIndex={0}
                  onPointerEnter={() => onHover(l.id)}
                  onPointerLeave={() => onHover(null)}
                  onFocus={() => onHover(l.id)}
                  onBlur={() => onHover(null)}
                >
                  <span className="cer-badge" style={{ '--line': l.color ?? 'var(--accent)' }}>
                    {l.code}
                  </span>
                  <span className="route-text">
                    <span className="route-name">{[l.from, l.to].filter(Boolean).join(' – ')}</span>
                    <span className="route-via">
                      {l.stations.length} estaciones · {l.nucleo}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {state.source && (
        <p className="panel-source">
          Fuente: <a href={state.source.url} target="_blank" rel="noreferrer">{state.source.name}</a>
        </p>
      )}
    </div>
  );
}
