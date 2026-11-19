/**
 * Calculadora de compensaciones por retraso en trenes de Renfe.
 *
 * Fuentes (revisadas en noviembre de 2026):
 *  - Compromiso de puntualidad de Renfe: https://www.renfe.com/es/es/ayuda/compromiso-puntualidad
 *  - Reglamento (UE) 2021/782 sobre los derechos de los viajeros de ferrocarril (arts. 18, 19, 20 y 28).
 *
 * Todo es lógica pura (sin React) para poder probarla con `npm test`.
 */

// ---------- Normas ----------

/**
 * Tramos de devolución de Renfe por tipo de billete.
 * `from`: minutos de retraso · `inclusive`: true = «igual o superior», false = «superior a» · `pct`: % devuelto.
 */
export const RENFE_RULES = {
  larga: [
    { from: 60, inclusive: true, pct: 50 },
    { from: 90, inclusive: false, pct: 100 },
  ],
  francia: [
    { from: 30, inclusive: false, pct: 25 },
    { from: 120, inclusive: false, pct: 50 },
    { from: 180, inclusive: false, pct: 75 },
  ],
  internacional: [
    { from: 30, inclusive: false, pct: 25 },
    { from: 120, inclusive: false, pct: 50 },
  ],
  avant: [
    { from: 15, inclusive: false, pct: 50 },
    { from: 30, inclusive: false, pct: 100 },
  ],
  regional: [
    { from: 30, inclusive: false, pct: 25 },
    { from: 45, inclusive: false, pct: 50 },
    { from: 60, inclusive: false, pct: 100 },
  ],
  integrado: [
    { from: 30, inclusive: false, pct: 50 },
    { from: 60, inclusive: false, pct: 100 },
  ],
  enlaces: [
    { from: 60, inclusive: false, pct: 50 },
    { from: 90, inclusive: false, pct: 100 },
  ],
  cercanias: [],
};

/** Mínimo que garantiza la ley europea (art. 19 del Reglamento 2021/782): 25 % desde 60 min y 50 % desde 120 min. */
export const EU_RULES = [
  { from: 60, inclusive: true, pct: 25 },
  { from: 120, inclusive: true, pct: 50 },
];

/**
 * Tipos de billete que puede elegir el viajero.
 * `extras`: admite cobrar con código de descuento (+50 %) o Puntos Renfe (+100 %).
 * Renfe solo lo ofrece en AVE y Larga Distancia nacionales (no en Avlo ni en trayectos internacionales).
 */
export const TRAIN_TYPES = [
  { id: 'ave', label: 'AVE', group: 'Alta velocidad y Larga Distancia', rule: 'larga', extras: true },
  { id: 'avlo', label: 'Avlo', group: 'Alta velocidad y Larga Distancia', rule: 'larga', extras: false },
  { id: 'euromed', label: 'AVE Euromed', group: 'Alta velocidad y Larga Distancia', rule: 'larga', extras: true },
  { id: 'alvia', label: 'Alvia', group: 'Alta velocidad y Larga Distancia', rule: 'larga', extras: true },
  { id: 'intercity', label: 'Intercity', group: 'Alta velocidad y Larga Distancia', rule: 'larga', extras: true },
  { id: 'avant', label: 'Avant', group: 'Media Distancia', rule: 'avant', extras: false },
  { id: 'regional', label: 'Regional / Regional Exprés', group: 'Media Distancia', rule: 'regional', extras: false },
  { id: 'fr-es', label: 'AVE España–Francia · tramo español', group: 'AVE internacional', rule: 'larga', extras: false },
  { id: 'fr-fr', label: 'AVE España–Francia · tramo francés', group: 'AVE internacional', rule: 'francia', extras: false },
  { id: 'fr-int', label: 'AVE España–Francia · trayecto internacional', group: 'AVE internacional', rule: 'internacional', extras: false },
  { id: 'avant-avant', label: 'Avant + Avant', group: 'Billete integrado (con enlace)', rule: 'integrado', extras: false },
  { id: 'avant-regional', label: 'Avant + Regional', group: 'Billete integrado (con enlace)', rule: 'integrado', extras: false },
  { id: 'regional-regional', label: 'Regional + Regional', group: 'Billete integrado (con enlace)', rule: 'integrado', extras: false },
  { id: 'otros-enlaces', label: 'Otros billetes con enlace', group: 'Billete integrado (con enlace)', rule: 'enlaces', extras: false },
  { id: 'cercanias', label: 'Cercanías / Rodalies', group: 'Cercanías', rule: 'cercanias', extras: false },
];
export const TRAIN_TYPE_BY_ID = Object.fromEntries(TRAIN_TYPES.map((t) => [t.id, t]));

/** Posibles causas del retraso (cambian lo que se puede reclamar). */
export const CAUSES = [
  { id: 'unknown', label: 'No lo sé / avería o problema del tren' },
  { id: 'adif', label: 'Limitación temporal de velocidad de Adif' },
  { id: 'force', label: 'Fuerza mayor (temporal extremo, catástrofe natural, actos de terceros…)' },
];

/** Desde esta fecha Renfe no indemniza los retrasos causados por limitaciones de velocidad de Adif. */
export const ADIF_EXCLUSION_FROM = '2026-01-31';
/** Horas que hay que esperar desde la llegada para pedir la indemnización. */
export const CLAIM_OPENS_AFTER_H = 24;
/** Meses desde la fecha del viaje para pedirla. */
export const CLAIM_MONTHS = 3;

// ---------- Cálculos ----------

/** «08:45» → 525 minutos desde medianoche (o null si no es una hora válida). */
export function parseTime(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/**
 * Retraso en minutos a partir de las horas del billete.
 * Tiene en cuenta los viajes que pasan de medianoche (salida 23:10, llegada 01:30).
 * Devuelve { ok: true, delay, duration } o { ok: false, error }.
 */
export function computeDelay({ departure, scheduledArrival, actualArrival }) {
  const dep = parseTime(departure);
  const sched = parseTime(scheduledArrival);
  const actual = parseTime(actualArrival);
  if (dep == null || sched == null || actual == null) return { ok: false, error: 'Rellena las tres horas.' };

  if (sched === dep) return { ok: false, error: 'La llegada prevista debe ser después de la salida.' };
  // Llegada prevista: si es «antes» que la salida, es al día siguiente.
  const schedAbs = sched > dep ? sched : sched + 1440;
  const duration = schedAbs - dep;

  // Llegada real: el momento (hoy o mañana) más cercano a la llegada prevista.
  let actualAbs = actual + (schedAbs >= 1440 ? 1440 : 0);
  if (actualAbs - schedAbs > 720) actualAbs -= 1440;
  if (schedAbs - actualAbs > 720) actualAbs += 1440;
  if (actualAbs <= dep) return { ok: false, error: 'La llegada real debe ser después de la salida.' };

  // `arrivalAbs`: minutos desde la medianoche del día de salida (más de 1440 = se llegó al día siguiente).
  return { ok: true, delay: Math.max(0, actualAbs - schedAbs), duration, arrivalAbs: actualAbs };
}

/** Porcentaje que corresponde a un retraso según una lista de tramos (el tramo más alto que se cumple). */
export function pctFor(rules, delay) {
  let pct = 0;
  for (const r of rules) if (r.inclusive ? delay >= r.from : delay > r.from) pct = Math.max(pct, r.pct);
  return pct;
}

/** Siguiente tramo que aún no se alcanza (para decir «con X min más te devolverían el Y %»). */
export function nextTier(rules, delay) {
  return rules.find((r) => !(r.inclusive ? delay >= r.from : delay > r.from)) ?? null;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Resultado completo para el viajero.
 *  - typeId, delay (min), price (€, opcional), cause, travelDate ('AAAA-MM-DD')
 * Renfe y la ley europea no se suman: se aplica la que sea más favorable.
 */
export function computeCompensation({ typeId, delay, price, cause = 'unknown', travelDate }) {
  const type = TRAIN_TYPE_BY_ID[typeId];
  if (!type) throw new Error(`Tipo de billete desconocido: ${typeId}`);
  const rules = RENFE_RULES[type.rule];
  const isCercanias = type.rule === 'cercanias';

  let renfePct = pctFor(rules, delay);
  // La ley europea permite excluir los servicios de Cercanías, y Renfe no tiene compromiso de puntualidad en ellos.
  let euPct = isCercanias ? 0 : pctFor(EU_RULES, delay);
  const notes = [];

  if (cause === 'force') {
    // Art. 19.10: con fuerza mayor la empresa no está obligada a indemnizar.
    renfePct = 0;
    euPct = 0;
    notes.push('force');
  } else if (cause === 'adif' && (!travelDate || travelDate >= ADIF_EXCLUSION_FROM)) {
    // Renfe lo excluye de su compromiso, pero la ley europea no considera fuerza mayor los problemas
    // de la infraestructura (art. 19.10.c excluye al administrador de infraestructuras de los «terceros»).
    renfePct = 0;
    notes.push('adif');
  }

  const pct = Math.max(renfePct, euPct);
  const source = pct === 0 ? null : renfePct >= euPct ? 'renfe' : 'eu';
  const validPrice = Number.isFinite(price) && price > 0 ? price : null;
  const amount = validPrice != null ? round2((validPrice * pct) / 100) : null;

  const payouts =
    amount != null && amount > 0
      ? [
          { id: 'same', label: 'En la misma forma de pago', amount },
          ...(type.extras && source === 'renfe'
            ? [
                { id: 'code', label: 'Código de descuento (+50 %)', amount: round2(amount * 1.5), hint: 'Para otro billete de igual o mayor importe, en 6 meses' },
                { id: 'points', label: 'Puntos Renfe (+100 %)', amount: round2(amount * 2), hint: 'Solo socios Más Renfe · 3 años para usarlos' },
              ]
            : []),
        ]
      : [];

  return {
    type,
    delay,
    pct,
    renfePct,
    euPct,
    source,
    amount,
    payouts,
    notes,
    isCercanias,
    next: source === 'eu' ? nextTier(EU_RULES, delay) : nextTier(rules, delay),
    /** Derecho a elegir reembolso o ruta alternativa y a asistencia (comida, alojamiento…). Arts. 18 y 20. */
    rightsAt60: !isCercanias && delay >= 60,
  };
}

// ---------- Plazos ----------

const DAY = 86_400_000;

/** Suma meses a una fecha 'AAAA-MM-DD' sin pasarse de fin de mes (31 ene + 1 mes = 28/29 feb). */
export function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * ¿Se puede reclamar ya? Se abre 24 h después de la llegada real y se cierra 3 meses después del viaje.
 * `arrivalMinutes`: minutos desde la medianoche del día del viaje (puede pasar de 1440 si se llegó al día siguiente).
 * Devuelve { state: 'wait' | 'open' | 'expired', opensAt, deadline } (fechas como Date / 'AAAA-MM-DD').
 */
export function claimWindow(travelDate, arrivalMinutes, now = new Date()) {
  const [y, m, d] = travelDate.split('-').map(Number);
  // Hora local española aproximada: se usa la hora local del navegador.
  const arrival = new Date(y, m - 1, d, 0, arrivalMinutes);
  const opensAt = new Date(arrival.getTime() + CLAIM_OPENS_AFTER_H * 3_600_000);
  const deadline = addMonths(travelDate, CLAIM_MONTHS);
  const [dy, dm, dd] = deadline.split('-').map(Number);
  const closesAt = new Date(dy, dm - 1, dd, 23, 59, 59);

  let state = 'open';
  if (now < opensAt) state = 'wait';
  else if (now > closesAt) state = 'expired';
  const daysLeft = Math.max(0, Math.ceil((closesAt - now) / DAY));
  return { state, opensAt, deadline, daysLeft };
}

/** Texto listo para pegar en el formulario de Renfe. */
export function claimSummary({ from, to, travelDate, departure, scheduledArrival, actualArrival, trainNumber, result }) {
  const lines = [
    `Solicito la indemnización por retraso según el compromiso de puntualidad de Renfe y el Reglamento (UE) 2021/782.`,
    `Trayecto: ${from || '—'} → ${to || '—'}${trainNumber ? ` · Tren ${trainNumber}` : ''} (${result.type.label})`,
    `Fecha del viaje: ${travelDate}`,
    `Salida: ${departure} · Llegada prevista: ${scheduledArrival} · Llegada real: ${actualArrival}`,
    `Retraso en la llegada: ${result.delay} minutos`,
  ];
  if (result.pct > 0) lines.push(`Devolución que corresponde: ${result.pct} %${result.amount != null ? ` (${fmtEuro(result.amount)})` : ''}`);
  return lines.join('\n');
}

export const fmtEuro = (n) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

/** «95 min» → «1 h 35 min». */
export function fmtMinutes(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Describe un tramo: «más de 30 min» / «60 min o más». */
export const tierLabel = (r) => (r.inclusive ? `${fmtMinutes(r.from)} o más` : `más de ${fmtMinutes(r.from)}`);
