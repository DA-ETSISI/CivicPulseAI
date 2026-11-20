/**
 * Huella de carbono de un trayecto en tren frente a hacerlo en coche particular.
 *
 * Factores oficiales:
 *  - Coche: MITECO, «Factores de emisión» de la Calculadora de huella de carbono (edición 2007-2025),
 *    opción A.2 «distancia recorrida», turismos (M1), año 2025. kg CO2e por km recorrido por el VEHÍCULO
 *    (no por persona). Origen: Sistema Español de Inventario de emisiones.
 *    https://www.miteco.gob.es/es/cambio-climatico/temas/mitigacion-politicas-y-medidas/calculadoras.html
 *  - Tren: huella de carbono unitaria de Renfe en 2024, 3,79 g CO2 por viajero·km, calculada según el
 *    Registro de huella de carbono del MITECO (Renfe Viajeros está inscrita) y verificada por AENOR.
 *    https://grupo.renfe.com/es/es/sostenibilidad/descarbonizacion
 *
 * Lógica pura (sin React) para poder probarla con `npm test`.
 */

/** kg CO2e por km recorrido por un turismo, según el combustible (MITECO 2025). */
export const CAR_FACTORS = {
  gasolina: { label: 'Gasolina', kgPerKm: 0.183 },
  diesel: { label: 'Diésel', kgPerKm: 0.159 },
};

/** kg CO2 por viajero y km en tren (Renfe 2024). */
export const TRAIN_KG_PER_PKM = 0.00379;

/** Plazas de un turismo: a partir de 6 viajeros harían falta dos coches. */
export const CAR_SEATS = 5;

/** Personas que viajan (los bebés también ocupan sitio en el coche y cuentan como viajeros). */
export const travellers = (pax) => (pax?.adults ?? 0) + (pax?.children ?? 0) + (pax?.infants ?? 0);

/**
 * Compara un trayecto en tren con el mismo recorrido en coche.
 *  - km: distancia entre estaciones (siguiendo las paradas del tren)
 *  - people: número de viajeros
 *  - fuel: 'gasolina' | 'diesel'
 * En coche las emisiones son por vehículo; en tren, por viajero.
 */
export function compareWithCar({ km, people, fuel = 'gasolina' }) {
  const car = CAR_FACTORS[fuel];
  if (!car) throw new Error(`Combustible desconocido: ${fuel}`);
  if (!Number.isFinite(km) || km <= 0 || !Number.isInteger(people) || people <= 0) return null;

  const cars = Math.ceil(people / CAR_SEATS);
  const carKg = car.kgPerKm * km * cars;
  const trainKg = TRAIN_KG_PER_PKM * km * people;
  const savedKg = Math.max(0, carKg - trainKg);

  return {
    km,
    people,
    cars,
    fuel,
    carKg: round1(carKg),
    trainKg: round1(trainKg),
    savedKg: round1(savedKg),
    /** Cuánto menos emite el tren, en %. */
    savedPct: carKg > 0 ? Math.round((savedKg / carKg) * 100) : 0,
    /** Cuántas veces más emite el coche. */
    times: trainKg > 0 ? Math.round(carKg / trainKg) : null,
  };
}

/** Suma las comparaciones de varios trayectos (ida y vuelta). */
export function sumComparisons(list) {
  const valid = list.filter(Boolean);
  if (!valid.length) return null;
  const carKg = valid.reduce((s, c) => s + c.carKg, 0);
  const trainKg = valid.reduce((s, c) => s + c.trainKg, 0);
  const savedKg = valid.reduce((s, c) => s + c.savedKg, 0);
  return {
    carKg: round1(carKg),
    trainKg: round1(trainKg),
    savedKg: round1(savedKg),
    savedPct: carKg > 0 ? Math.round((savedKg / carKg) * 100) : 0,
  };
}

const round1 = (n) => Math.round(n * 10) / 10;

/** «12,3 kg» o «850 g» si es menos de un kilo. */
export function fmtKg(kg) {
  if (kg < 1) return `${Math.round(kg * 1000).toLocaleString('es-ES')} g`;
  return `${kg.toLocaleString('es-ES', { maximumFractionDigits: kg < 10 ? 1 : 0 })} kg`;
}
