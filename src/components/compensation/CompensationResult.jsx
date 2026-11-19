import { useState } from 'react';
import { EU_RULES, RENFE_RULES, fmtEuro, fmtMinutes, tierLabel } from '../../lib/compensation.js';
import { LINKS } from './links.js';

const fmtDay = (d) => d.toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const fmtIso = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

/** Resultado de la calculadora: cuánto te devuelven, cómo cobrarlo y si estás a tiempo de pedirlo. */
export default function CompensationResult({ result, window: claim, summary }) {
  const [copied, setCopied] = useState(null);

  if (!result) {
    return (
      <div className="card comp-result is-empty" aria-live="polite">
        <h3 className="comp-card-title">
          <span className="comp-step">2</span> Tu compensación
        </h3>
        <p>Rellena las tres horas del viaje y te diremos al momento cuánto te corresponde.</p>
      </div>
    );
  }

  const { delay, pct, amount, payouts, source, notes, next, isCercanias, type } = result;
  const rules = RENFE_RULES[type.rule];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied('ok');
    } catch {
      setCopied('error');
    }
    setTimeout(() => setCopied(null), 2500);
  };

  return (
    <div className={`card comp-result${pct > 0 ? ' is-positive' : ''}`} aria-live="polite">
      <h3 className="comp-card-title">
        <span className="comp-step">2</span> Tu compensación
      </h3>

      <p className="comp-delay">
        {delay > 0 ? (
          <>
            Llegaste con <strong>{fmtMinutes(delay)}</strong> de retraso
          </>
        ) : (
          <>Tu tren llegó a su hora (o antes)</>
        )}
      </p>

      <div className="comp-big">
        <span className="comp-pct">{pct}%</span>
        <span className="comp-big-label">
          {pct > 0 ? 'del precio del billete' : 'sin devolución'}
          {amount != null && pct > 0 && <strong className="comp-amount">{fmtEuro(amount)}</strong>}
        </span>
      </div>

      {source === 'renfe' && <p className="comp-source">Según el compromiso de puntualidad de Renfe para {type.label}.</p>}
      {source === 'eu' && (
        <p className="comp-source">
          Por el <strong>mínimo de la ley europea</strong> (Reglamento 2021/782), que en tu caso es más favorable que el compromiso de Renfe.
        </p>
      )}

      {!isCercanias && <DelayScale rules={source === 'eu' ? EU_RULES : rules} delay={delay} />}

      {next && !notes.includes('force') && (
        <p className="comp-next">
          Con un retraso de {tierLabel(next)} te correspondería el {next.pct}%.
        </p>
      )}

      {notes.includes('force') && (
        <p className="comp-note">
          Si el retraso se debió a <strong>fuerza mayor</strong> (temporal extremo, catástrofes, actos de terceros…), la empresa no está obligada a indemnizar.
          Aun así puedes pedir el reembolso o un viaje alternativo si el retraso supera los 60 minutos.
        </p>
      )}
      {notes.includes('adif') && (
        <p className="comp-note">
          Renfe no aplica su compromiso de puntualidad a billetes comprados desde el 31 de enero de 2026 si el retraso se debe a
          limitaciones de velocidad de Adif. La ley europea no considera fuerza mayor los problemas de la infraestructura, así que
          {result.euPct > 0 ? ` puedes reclamar el mínimo europeo (${result.euPct}%).` : ' solo podrías reclamar a partir de 60 minutos de retraso.'}
        </p>
      )}
      {isCercanias && (
        <p className="comp-note">
          Cercanías no tiene compromiso de devolución por retraso. Puedes pedir un <strong>justificante de retraso</strong> (útil para el trabajo o
          un examen) en la web de Cercanías de tu ciudad y poner una reclamación si el servicio fue deficiente.
        </p>
      )}

      {payouts.length > 0 && (
        <div className="comp-payouts">
          <p className="field-label">Elige cómo cobrarlo</p>
          <ul>
            {payouts.map((p, i) => (
              <li key={p.id} className={i === payouts.length - 1 && payouts.length > 1 ? 'is-best' : undefined}>
                <span>
                  {p.label}
                  {p.hint && <small>{p.hint}</small>}
                </span>
                <strong>{fmtEuro(p.amount)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      {pct > 0 && amount == null && <p className="form-hint">Añade el precio del billete para ver el importe exacto.</p>}

      {claim && pct > 0 && <ClaimStatus claim={claim} />}

      <div className="comp-actions">
        {pct > 0 && claim?.state !== 'expired' && (
          <a className="btn" href={LINKS.claim} target="_blank" rel="noreferrer">
            Solicitar en renfe.com
            <ExternalIcon />
          </a>
        )}
        {isCercanias && (
          <a className="btn" href={LINKS.cercaniasProof} target="_blank" rel="noreferrer">
            Justificante (Cercanías Madrid)
            <ExternalIcon />
          </a>
        )}
        <button type="button" className="btn btn-ghost" onClick={copy}>
          {copied === 'ok' ? '¡Copiado!' : copied === 'error' ? 'No se pudo copiar' : 'Copiar datos del viaje'}
        </button>
      </div>
    </div>
  );
}

/** Barra con los tramos de devolución y la posición del retraso del viajero. */
function DelayScale({ rules, delay }) {
  if (!rules.length) return null;
  const max = Math.max(rules.at(-1).from * 1.35, delay * 1.08, 30);
  const at = (min) => `${Math.min(100, (min / max) * 100)}%`;
  return (
    <div className="comp-scale" role="img" aria-label={`Retraso de ${delay} minutos frente a los tramos de devolución`}>
      <div className="comp-scale-track">
        {rules.map((r, i) => (
          <span
            key={r.from}
            className="comp-scale-band"
            style={{ left: at(r.from), width: `calc(${at(rules[i + 1]?.from ?? max)} - ${at(r.from)})`, opacity: 0.25 + (r.pct / 100) * 0.75 }}
          />
        ))}
        <span className="comp-scale-marker" style={{ left: at(delay) }} />
      </div>
      <div className="comp-scale-labels">
        {rules.map((r) => (
          <span key={r.from} style={{ left: at(r.from) }}>
            {r.from}′<b>{r.pct}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function ClaimStatus({ claim }) {
  if (claim.state === 'wait') {
    return <p className="comp-claim is-wait">Podrás pedirla a partir del {fmtDay(claim.opensAt)} (24 h después de la llegada).</p>;
  }
  if (claim.state === 'expired') {
    return <p className="comp-claim is-expired">El plazo terminó el {fmtIso(claim.deadline)}: solo se puede pedir en los 3 meses siguientes al viaje.</p>;
  }
  return (
    <p className="comp-claim is-open">
      Estás a tiempo: tienes hasta el <strong>{fmtIso(claim.deadline)}</strong> ({claim.daysLeft} {claim.daysLeft === 1 ? 'día' : 'días'}).
    </p>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
      <path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
