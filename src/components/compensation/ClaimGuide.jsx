import { LINKS } from './links.js';

const STEPS = [
  {
    title: 'Guarda tu billete y apunta las horas',
    body: 'Necesitarás el localizador (el código de 6 caracteres del billete) y la hora real de llegada. Si te lo dan, guarda también el justificante de retraso.',
  },
  {
    title: 'Espera 24 horas desde la llegada',
    body: 'Renfe no acepta la solicitud hasta pasado un día desde que llegó el tren. Tienes como máximo 3 meses desde la fecha del viaje.',
  },
  {
    title: 'Pide la indemnización en renfe.com',
    body: 'Entra en «Solicita indemnización», escribe el localizador y tu correo o DNI. También puedes pedirla en la taquilla, en atención al cliente de la estación o en la agencia donde compraste el billete.',
    link: { href: LINKS.claim, label: 'Solicita indemnización' },
  },
  {
    title: 'Elige cómo quieres cobrar',
    body: 'En la misma forma de pago, con un código de descuento con un 50 % más o, si eres socio de Más Renfe, en Puntos Renfe con un 100 % más (no disponible en Avlo ni en trayectos internacionales).',
  },
  {
    title: 'Si no estás de acuerdo, reclama',
    body: 'Si te la deniegan o no te responden, presenta una reclamación. Renfe debe contestarte en un mes como máximo (hasta tres en casos justificados).',
    link: { href: LINKS.complaint, label: 'Tramita tu reclamación' },
  },
  {
    title: 'Último paso: consumo',
    body: 'Si sigues sin solución, acude a la oficina de consumo de tu ayuntamiento o comunidad autónoma (OMIC) o a la Junta Arbitral de Transporte. Lleva el billete, el justificante y la respuesta de Renfe.',
  },
];

/** Guía paso a paso para reclamar, con enlaces a las páginas oficiales. */
export default function ClaimGuide() {
  return (
    <div className="card comp-guide">
      <h3 className="comp-card-title">Cómo reclamar, paso a paso</h3>
      <ol className="comp-steps">
        {STEPS.map((s) => (
          <li key={s.title}>
            <p className="comp-steps-title">{s.title}</p>
            <p>{s.body}</p>
            {s.link && (
              <a href={s.link.href} target="_blank" rel="noreferrer" className="comp-link">
                {s.link.label} en renfe.com →
              </a>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
