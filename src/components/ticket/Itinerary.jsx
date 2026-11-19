import { useEffect, useState } from 'react';
import { madridEpoch } from '../../lib/myTicket.js';
import { fmtDate, fmtDuration, fmtTime } from '../../lib/timetable.js';

/** Minutos mínimos para cambiar de tren en la misma estación, y entre dos estaciones de la misma ciudad. */
const MIN_CHANGE = 5;
const MIN_CHANGE_OTHER_STATION = 30;
const SOON_MIN = 15;

/** Hora actual, actualizada cada `ms` milisegundos. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/**
 * Línea temporal del viaje con los retrasos en tiempo real (si los hay):
 * cada tramo con su salida y llegada previstas (ms) y cada transbordo con su margen real.
 * `incidents` (opcional): { número de tren: { cancelled?: true, platform?: 'vía nueva' } }.
 */
export function timeline(itinerary, delays = {}, incidents = {}) {
  const legs = itinerary.legs.map((leg) => {
    const inc = incidents[leg.number] ?? {};
    const delay = inc.cancelled ? 0 : (delays[leg.number] ?? 0);
    const platform = inc.platform ?? leg.platform ?? null;
    return {
      ...leg,
      delay,
      cancelled: Boolean(inc.cancelled),
      platform,
      plannedPlatform: leg.platform && platform !== leg.platform ? leg.platform : null,
      depAt: madridEpoch(itinerary.date, leg.dep) + Math.max(0, delay) * 60_000,
      arrAt: madridEpoch(itinerary.date, leg.arr) + Math.max(0, delay) * 60_000,
    };
  });
  const transfers = itinerary.transfers.map((t, i) => {
    const need = t.sameStation ? MIN_CHANGE : MIN_CHANGE_OTHER_STATION;
    const margin = Math.round((legs[i + 1].depAt - legs[i].arrAt) / 60_000);
    const cancelled = legs[i].cancelled || legs[i + 1].cancelled;
    return { ...t, need, margin, cancelled, state: cancelled || margin < need ? 'risk' : margin < need + 5 ? 'tight' : 'ok' };
  });
  return { legs, transfers, endsAt: legs.at(-1).arrAt };
}

/** «1 h 12 min» (y segundos cuando falta menos de una hora). */
export function fmtCountdown(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${String(sec).padStart(2, '0')} s`;
  return `${sec} s`;
}

/** Qué toca ahora: esperar al primer tren, ir en un tren, hacer un transbordo o viaje terminado. */
function currentStep(tl, now) {
  const { legs } = tl;
  if (now < legs[0].depAt) return { kind: 'before', next: 0 };
  for (let i = 0; i < legs.length; i++) {
    if (now < legs[i].arrAt) return { kind: 'onboard', leg: i };
    if (tl.transfers[i] && (tl.transfers[i].margin < 0 || tl.transfers[i].cancelled)) return { kind: 'missed', transfer: i };
    if (i + 1 < legs.length && now < legs[i + 1].depAt) return { kind: 'transfer', next: i + 1, transfer: i };
  }
  return { kind: 'done' };
}

/** Cuenta atrás en vivo hasta el siguiente tren que hay que coger. */
export function Countdown({ tl, now }) {
  const step = currentStep(tl, now);
  if (step.kind === 'done') {
    return (
      <div className="countdown is-done" role="status">
        <p className="countdown-label">Has llegado a {tl.legs.at(-1).to}</p>
        <p className="countdown-sub">Tu viaje ha terminado. ¡Buen viaje de vuelta!</p>
      </div>
    );
  }

  if (step.kind === 'missed') {
    const t = tl.transfers[step.transfer];
    return (
      <div className="countdown is-risk" role="status">
        <p className="countdown-label">Transbordo perdido en {t.at}</p>
        <p className="countdown-value">Busca otro tren</p>
        <p className="countdown-sub">
          {t.cancelled
            ? `El tren ${t.nextNumber} está cancelado. Mira los próximos trenes más abajo.`
            : `El tren ${t.nextNumber} salió antes de que llegaras. Mira los próximos trenes más abajo.`}
        </p>
      </div>
    );
  }

  if (step.kind === 'onboard') {
    const leg = tl.legs[step.leg];
    const nextLeg = tl.legs[step.leg + 1];
    const transfer = tl.transfers[step.leg];
    return (
      <div className={`countdown${transfer && transfer.state !== 'ok' ? ` is-${transfer.state}` : ''}`} role="timer" aria-live="off">
        <p className="countdown-label">En el tren {leg.number} hacia {leg.to}</p>
        <p className="countdown-value num">Llegas en {fmtCountdown(leg.arrAt - now)}</p>
        {nextLeg && (
          <p className="countdown-sub">
            {transfer.cancelled
              ? `Después tenías transbordo al tren ${nextLeg.number}, pero está cancelado: mira las alternativas más abajo.`
              : transfer.margin < 0
                ? `Después tenías transbordo al tren ${nextLeg.number}, pero saldrá ${-transfer.margin} min antes de que llegues: mira las alternativas más abajo.`
                : `Después, transbordo al tren ${nextLeg.number}: ${transfer.margin} min para cambiar`}
            {!transfer.cancelled && transfer.margin >= 0 && transfer.state === 'risk' && ' · el retraso pone en riesgo el transbordo'}
          </p>
        )}
      </div>
    );
  }

  const leg = tl.legs[step.next];
  const left = leg.depAt - now;
  const transfer = step.kind === 'transfer' ? tl.transfers[step.transfer] : null;
  const soon = left < SOON_MIN * 60_000;
  const state = leg.cancelled ? 'risk' : transfer && transfer.state !== 'ok' ? transfer.state : soon ? 'soon' : null;
  const risky = !transfer && tl.transfers.find((t) => t.state === 'risk');
  return (
    <div className={`countdown${state ? ` is-${state}` : risky ? ' is-risk' : ''}`} role="timer" aria-live="off">
      <p className="countdown-label">{transfer ? `Transbordo en ${transfer.at}` : 'Tu próximo tren'}</p>
      <p className="countdown-value num">{leg.cancelled ? 'Tren cancelado' : `Sale en ${fmtCountdown(left)}`}</p>
      <p className="countdown-sub">
        Tren {leg.number} · {leg.type} · {fmtTime((leg.dep + Math.max(0, leg.delay)) % 1440)} desde {leg.from}
        {leg.platform && ` · vía ${leg.platform}`}
        {leg.delay > 0 && ` · con ${leg.delay} min de retraso`}
      </p>
      {leg.plannedPlatform && (
        <p className="countdown-sub countdown-warning">
          Cambio de vía: sale por la vía {leg.platform} (antes la {leg.plannedPlatform}).
        </p>
      )}
      {risky && (
        <p className="countdown-sub countdown-warning">
          {risky.cancelled
            ? `Atención: el transbordo en ${risky.at} no se puede hacer porque el tren ${risky.nextNumber} está cancelado.`
            : `Atención: el transbordo en ${risky.at} está en riesgo por un retraso.`}
        </p>
      )}
    </div>
  );
}

/**
 * Incidencia en el viaje: qué tren va con retraso y qué pasa con el transbordo siguiente.
 * Si ya no da tiempo, propone los próximos trenes desde la estación del transbordo hasta el destino.
 */
export function IncidentPanel({ tl, alternatives, simulated }) {
  const delayed = tl.legs.map((l, i) => ({ l, i })).filter(({ l }) => l.delay > 0 || l.cancelled || l.plannedPlatform);
  if (!delayed.length) return null;
  const worst = tl.transfers.find((t) => t.state === 'risk') ?? tl.transfers.find((t) => t.state === 'tight');
  const title = tl.legs.some((l) => l.cancelled)
    ? 'Tren cancelado en tu viaje'
    : worst?.state === 'risk'
      ? worst.margin < 0
        ? 'Transbordo perdido'
        : 'Puede que pierdas el transbordo'
      : delayed.every(({ l }) => !l.delay)
        ? 'Cambio de vía'
        : 'Incidencia en tu viaje';

  return (
    <section className={`incident is-${worst?.state ?? 'delay'}`} role="alert" aria-labelledby="incident-title">
      <h2 id="incident-title">
        {title}
        {simulated && <span className="incident-sim">{simulated}</span>}
      </h2>
      <ul className="incident-list">
        {delayed.map(({ l, i }) => {
          const t = tl.transfers[i];
          const next = tl.legs[i + 1];
          let transferText = null;
          if (l.cancelled) {
            const before = tl.transfers[i - 1];
            transferText = before
              ? `No podrás hacer el transbordo en ${before.at}. Abajo tienes los próximos trenes desde allí.`
              : 'Pregunta a Renfe por otro tren o por la devolución del billete.';
          } else if (t && next && next.cancelled) {
            transferText = null;
          } else if (t && next && l.delay > 0) {
            if (t.state === 'risk') {
              const gap = t.margin < 0 ? `saldría ${-t.margin} min antes de que llegues` : `te quedarían solo ${t.margin} min`;
              transferText = `El tren ${next.number} sale de ${t.nextFrom} a las ${fmtTime(next.dep)}: ${gap} y necesitas al menos ${t.need} min para cambiar. Con este retraso no da tiempo a hacer el transbordo.`;
            } else if (t.state === 'tight') {
              transferText = `Te quedan ${t.margin} min para coger el tren ${next.number} en ${t.at}: es un transbordo ajustado.`;
            } else {
              transferText = `El transbordo al tren ${next.number} sigue siendo viable: tendrás ${t.margin} min para cambiar.`;
            }
          }
          return (
            <li key={l.number}>
              {l.cancelled ? (
                <p>
                  <strong>
                    El tren {l.number} ({l.type}) de {l.from} a {l.to} está cancelado.
                  </strong>
                </p>
              ) : l.delay > 0 ? (
                <p>
                  <strong>
                    El tren {l.number} ({l.type}) circula con {l.delay} min de retraso.
                  </strong>{' '}
                  Llegada prevista a {l.to} a las {fmtTime((l.arr + l.delay) % 1440)} en vez de a las {fmtTime(l.arr)}.
                </p>
              ) : null}
              {l.plannedPlatform && (
                <p>
                  <strong>
                    Cambio de vía: el tren {l.number} sale de {l.from} por la vía {l.platform}
                  </strong>{' '}
                  (antes estaba anunciado en la vía {l.plannedPlatform}).
                </p>
              )}
              {transferText && <p>{transferText}</p>}
            </li>
          );
        })}
      </ul>

      {worst?.state === 'risk' && (
        <div className="incident-alternatives">
          <h3>
            Próximos trenes desde {worst.at} hasta {tl.legs.at(-1).to}
          </h3>
          {alternatives.length ? (
            <ul>
              {alternatives.map((a) => (
                <li key={a.id}>
                  <span className="num">{fmtTime(a.dep)}</span> → <span className="num">{fmtTime(a.arr)}</span> · {a.type} {a.number}
                  {a.stopsBetween === 0 ? ' · directo' : ` · ${a.stopsBetween} paradas`}
                </li>
              ))}
            </ul>
          ) : (
            <p>No hay más trenes hoy en los horarios de Renfe para ese trayecto.</p>
          )}
          <p className="incident-note">Pregunta al personal de Renfe en la estación antes de cambiar de tren o de billete.</p>
        </div>
      )}
    </section>
  );
}

/** Itinerario: cada tramo en tren y, entre ellos, los transbordos destacados. */
export default function Itinerary({ itinerary, tl, extra }) {
  return (
    <div className="itinerary">
      <p className="itinerary-date">
        {fmtDate(itinerary.date, { weekday: 'long', day: 'numeric', month: 'long' })}
        {extra?.car && ` · Coche ${extra.car}`}
        {extra?.seat && ` · Plaza ${extra.seat}`}
      </p>
      <ol className="itinerary-legs">
        {tl.legs.map((leg, i) => (
          <li key={`${leg.number}-${i}`} className={`itinerary-item${leg.cancelled ? ' is-cancelled' : ''}`}>
            <div className="leg" style={{ '--leg': `var(--leg-${i % 4})` }}>
              <div className="leg-head">
                <span className="badge">{leg.type}</span>
                <span className="leg-train">Tren {leg.number}</span>
                {leg.platform && <span className={`official-tag${leg.plannedPlatform ? ' is-late' : ''}`}>Vía {leg.platform}</span>}
                {leg.cancelled && <span className="official-tag is-late">Cancelado</span>}
                {leg.delay > 0 && <span className="official-tag is-late">+{leg.delay} min</span>}
                {leg.delay === 0 && !leg.cancelled && leg.live && <span className="official-tag is-ok">Puntual</span>}
              </div>
              <div className="leg-times">
                <span className="leg-time num">{fmtTime(leg.dep)}</span>
                <span className="leg-duration">
                  <span>{fmtDuration(leg.arr - leg.dep)}</span>
                </span>
                <span className="leg-time num">{fmtTime(leg.arr)}</span>
              </div>
              {leg.cancelled && <p className="leg-expected">Este tren está cancelado.</p>}
              {leg.plannedPlatform && (
                <p className="leg-expected">
                  Cambio de vía: sale por la vía {leg.platform} (antes la {leg.plannedPlatform})
                </p>
              )}
              {leg.delay > 0 && (
                <p className="leg-expected">
                  Previsto: sale <span className="num">{fmtTime((leg.dep + leg.delay) % 1440)}</span> · llega{' '}
                  <span className="num">{fmtTime((leg.arr + leg.delay) % 1440)}</span>
                </p>
              )}
              <div className="leg-stations">
                <span>{leg.from}</span>
                <span>{leg.to}</span>
              </div>
              {leg.stops.length > 2 && (
                <p className="leg-via">
                  {leg.stops.length - 2} {leg.stops.length - 2 === 1 ? 'parada intermedia' : 'paradas intermedias'}:{' '}
                  {leg.stops
                    .slice(1, -1)
                    .map((s) => s.name)
                    .join(', ')}
                </p>
              )}
            </div>

            {tl.transfers[i] && (
              <div className={`transfer is-${tl.transfers[i].state}`} role="note">
                <strong>
                  {tl.transfers[i].cancelled
                    ? `Transbordo en ${tl.transfers[i].at} · no es posible: el tren ${tl.legs[i].cancelled ? tl.legs[i].number : tl.transfers[i].nextNumber} está cancelado`
                    : tl.transfers[i].margin >= 0
                    ? `Transbordo en ${tl.transfers[i].at} · ${tl.transfers[i].margin} min para cambiar al tren ${tl.transfers[i].nextNumber}`
                    : `Transbordo en ${tl.transfers[i].at} · el tren ${tl.transfers[i].nextNumber} sale ${-tl.transfers[i].margin} min antes de que llegues`}
                </strong>
                {!tl.transfers[i].cancelled && tl.transfers[i].margin !== tl.transfers[i].minutes && (
                  <span>
                    Según el horario tenías {tl.transfers[i].minutes} min para cambiar.
                  </span>
                )}
                {!tl.transfers[i].sameStation && <span>Sales de otra estación: {tl.transfers[i].nextFrom}.</span>}
                {tl.transfers[i].state === 'tight' && <span>Es un transbordo ajustado.</span>}
                {tl.transfers[i].state === 'risk' && !tl.transfers[i].cancelled && (
                  <span>Con el retraso actual puede que no llegues a tiempo: consulta a Renfe antes de cambiar de tren.</span>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
