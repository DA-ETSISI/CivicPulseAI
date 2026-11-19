import { LINKS } from './links.js';

/** Derechos que da la ley europea a cualquier viajero de tren (Reglamento UE 2021/782). `icon`: trazo SVG. */
const RIGHTS = [
  {
    icon: 'M7 8H4V5 M4.5 8A7 7 0 1 1 3 12',
    title: 'Reembolso o tren alternativo',
    body: 'Si se prevé un retraso de 60 minutos o más, puedes elegir entre que te devuelvan el billete completo, seguir el viaje o ir por otra ruta lo antes posible o el día que prefieras.',
  },
  {
    icon: 'M4 8h11v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z M15 9h1.5a2.5 2.5 0 0 1 0 5H15 M8 3v2 M11 3v2',
    title: 'Comida y bebida',
    body: 'Con una espera de más de 60 minutos te deben ofrecer comida y refrescos en proporción al tiempo de espera, si hay disponibles.',
  },
  {
    icon: 'M3 17V6 M3 13h16v4 M3 10h5a2 2 0 0 1 2 2v1 M10 10h6a3 3 0 0 1 3 3',
    title: 'Alojamiento',
    body: 'Si tienes que pasar la noche por el retraso o la cancelación, la empresa debe ofrecerte hotel y el transporte hasta él.',
  },
  {
    icon: 'M15 6.5A6 6 0 1 0 15 15.5 M3 9.5h8 M3 12.5h8',
    title: 'Indemnización mínima',
    body: '25 % del billete con 60 a 119 minutos de retraso y 50 % a partir de 120 minutos. Te la deben pagar en un mes y en dinero si lo pides. Renfe mejora estos mínimos en casi todos sus trenes.',
  },
  {
    icon: 'M11 3 20 18H2L11 3Z M11 9v4 M11 15.5v.5',
    title: 'Cuándo no hay indemnización',
    body: 'Por fuerza mayor: temporales extremos, catástrofes naturales, crisis sanitarias graves o actos de terceros (no cuentan las averías del tren ni los problemas de la vía). Aun así, conservas el derecho al reembolso y a la asistencia.',
  },
];

export default function PassengerRights() {
  return (
    <div className="card comp-rights">
      <h3 className="comp-card-title">Tus derechos como pasajero</h3>
      <ul className="comp-rights-list">
        {RIGHTS.map((r) => (
          <li key={r.title}>
            <span className="comp-rights-icon" aria-hidden="true">
              <svg viewBox="0 0 22 22" width="18" height="18">
                <path d={r.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="comp-steps-title">{r.title}</p>
              <p>{r.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="summary-note">
        Fuentes:{' '}
        <a href={LINKS.rules} target="_blank" rel="noreferrer">
          Compromiso de puntualidad de Renfe
        </a>{' '}
        ·{' '}
        <a href={LINKS.euRegulation} target="_blank" rel="noreferrer">
          Reglamento (UE) 2021/782
        </a>
        . Esta calculadora es orientativa: la decisión final es de Renfe.
      </p>
    </div>
  );
}
