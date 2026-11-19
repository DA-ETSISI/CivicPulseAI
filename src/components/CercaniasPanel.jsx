import { IconArrowLeft } from './icons.jsx';
import { hhmm, splitByService } from '../lib/serviceStatus.js';

/** Fila de una línea de Cercanías: distintivo con su color oficial, recorrido y estado de servicio. */
function CerItem({ line, hoveredId, onHover }) {
  const inactive = line.status?.state === 'inactive';
  return (
    <li>
      <div
        className={`cer-item${hoveredId === line.id ? ' is-hover' : ''}${inactive ? ' is-inactive' : ''}`}
        tabIndex={0}
        onPointerEnter={() => onHover(line.id)}
        onPointerLeave={() => onHover(null)}
        onFocus={() => onHover(line.id)}
        onBlur={() => onHover(null)}
      >
        <span className="cer-badge" style={{ '--line': line.color ?? 'var(--accent)' }}>
          {line.code}
        </span>
        <span className="route-text">
          <span className="route-name">{[line.from, line.to].filter(Boolean).join(' – ')}</span>
          <span className="route-via">
            {line.stations.length} estaciones · {line.nucleo}
          </span>
          {inactive && <span className="route-via route-status">Sin servicio ahora · {line.status.label}</span>}
        </span>
      </div>
    </li>
  );
}

/** El próximo tren más temprano de toda la red (para el aviso «Primer tren a las…»). */
function firstNext(lines) {
  return lines
    .map((l) => l.status?.next)
    .filter(Boolean)
    .sort((a, b) => a.offset - b.offset || a.minutes - b.minutes)[0];
}

/** Panel en modo provincia: las líneas de Cercanías (o Rodalies) que tienen estaciones en ella. */
export default function CercaniasPanel({ provinceName, state, hoveredId, onHover, onBack }) {
  const networks = [...new Set(state.lines.map((l) => l.nucleo))];
  const isRodalies = networks.some((n) => n.startsWith('Rodalies'));
  const { active, inactive } = splitByService(state.lines, (l) => l.status ?? {});
  const noneRunning = state.status === 'ready' && state.lines.length > 0 && inactive.length === state.lines.length;
  const first = noneRunning ? firstNext(state.lines) : null;

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

      {noneRunning && (
        <p className="service-notice" role="status">
          Ahora mismo no circula ningún tren en esta red.
          {first && ` Primer tren ${first.offset === 0 ? '' : first.offset === 1 ? 'mañana ' : `dentro de ${first.offset} días `}a las ${hhmm(first.minutes)}.`}
        </p>
      )}

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
            {active.map((l) => (
              <CerItem key={l.id} line={l} hoveredId={hoveredId} onHover={onHover} />
            ))}
            {inactive.length > 0 && active.length > 0 && (
              <li className="service-divider" role="presentation">
                Sin servicio ahora
              </li>
            )}
            {inactive.map((l) => (
              <CerItem key={l.id} line={l} hoveredId={hoveredId} onHover={onHover} />
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
