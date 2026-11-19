/**
 * Filtros del mapa en directo: tipo de servicio, red de Cercanías y lugar (provincia o ciudad).
 * La clasificación de cada tren la hace el servidor (server/index.mjs → /api/trenes).
 */

export const SERVICES = [
  { id: 'larga', label: 'Larga distancia', hint: 'AVE, AVLO, Euromed, Intercity' },
  { id: 'media', label: 'Media distancia', hint: 'AVANT y Regionales' },
  { id: 'corta', label: 'Corta distancia', hint: 'Cercanías y Rodalies' },
];
export const SERVICE_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s]));

export const NETWORKS = [
  { id: 'madrid', label: 'Madrid' },
  { id: 'barcelona', label: 'Barcelona', sub: 'Rodalies' },
  { id: 'valencia', label: 'Valencia' },
  { id: 'euskadi', label: 'Euskadi', sub: 'Bilbao · Donostia' },
  { id: 'asturias', label: 'Asturias' },
  { id: 'cantabria', label: 'Cantabria' },
  { id: 'sevilla', label: 'Sevilla' },
  { id: 'malaga', label: 'Málaga' },
  { id: 'cadiz', label: 'Cádiz' },
  { id: 'murcia', label: 'Murcia', sub: 'y Alicante' },
  { id: 'zaragoza', label: 'Zaragoza' },
  { id: 'leon', label: 'León' },
  { id: 'ferrol', label: 'Ferrol' },
];
export const NETWORK_BY_ID = Object.fromEntries(NETWORKS.map((n) => [n.id, n]));

/** Radio (km) alrededor de una ciudad para filtrar trenes y encuadrar el mapa. */
export const CITY_RADIUS_KM = 35;

/** Ciudades con estación importante. `province` es el código INE de su provincia. */
export const CITIES = [
  { name: 'Madrid', province: '28', lat: 40.4168, lon: -3.7038 },
  { name: 'Barcelona', province: '08', lat: 41.3874, lon: 2.1686 },
  { name: 'Valencia', province: '46', lat: 39.4699, lon: -0.3763, aliases: ['València'] },
  { name: 'Sevilla', province: '41', lat: 37.3891, lon: -5.9845 },
  { name: 'Zaragoza', province: '50', lat: 41.6488, lon: -0.8891 },
  { name: 'Málaga', province: '29', lat: 36.7213, lon: -4.4214 },
  { name: 'Bilbao', province: '48', lat: 43.263, lon: -2.935, aliases: ['Bilbo'] },
  { name: 'San Sebastián', province: '20', lat: 43.3183, lon: -1.9812, aliases: ['Donostia'] },
  { name: 'Vitoria-Gasteiz', province: '01', lat: 42.8467, lon: -2.6716 },
  { name: 'Oviedo', province: '33', lat: 43.3614, lon: -5.8494 },
  { name: 'Gijón', province: '33', lat: 43.5322, lon: -5.6611, aliases: ['Xixón'] },
  { name: 'Santander', province: '39', lat: 43.4623, lon: -3.81 },
  { name: 'Pamplona', province: '31', lat: 42.8125, lon: -1.6458, aliases: ['Iruña'] },
  { name: 'Valladolid', province: '47', lat: 41.6523, lon: -4.7245 },
  { name: 'Murcia', province: '30', lat: 37.9922, lon: -1.1307 },
  { name: 'Cartagena', province: '30', lat: 37.6257, lon: -0.9966 },
  { name: 'Alicante', province: '03', lat: 38.3452, lon: -0.481, aliases: ['Alacant'] },
  { name: 'Elche', province: '03', lat: 38.2699, lon: -0.6983, aliases: ['Elx'] },
  { name: 'Córdoba', province: '14', lat: 37.8882, lon: -4.7794 },
  { name: 'Granada', province: '18', lat: 37.1773, lon: -3.5986 },
  { name: 'Cádiz', province: '11', lat: 36.5271, lon: -6.2886 },
  { name: 'Jerez de la Frontera', province: '11', lat: 36.685, lon: -6.1261 },
  { name: 'A Coruña', province: '15', lat: 43.3623, lon: -8.4115, aliases: ['La Coruña'] },
  { name: 'Santiago de Compostela', province: '15', lat: 42.8782, lon: -8.5448 },
  { name: 'Vigo', province: '36', lat: 42.2406, lon: -8.7207 },
  { name: 'Ferrol', province: '15', lat: 43.4896, lon: -8.2193 },
  { name: 'León', province: '24', lat: 42.5987, lon: -5.5671 },
  { name: 'Salamanca', province: '37', lat: 40.9701, lon: -5.6635 },
  { name: 'Burgos', province: '09', lat: 42.3439, lon: -3.6969 },
  { name: 'Tarragona', province: '43', lat: 41.1189, lon: 1.2445 },
  { name: 'Girona', province: '17', lat: 41.9794, lon: 2.8214 },
  { name: 'Lleida', province: '25', lat: 41.6176, lon: 0.62 },
  { name: 'Castellón de la Plana', province: '12', lat: 39.9864, lon: -0.0513 },
  { name: 'Albacete', province: '02', lat: 38.9943, lon: -1.8585 },
  { name: 'Toledo', province: '45', lat: 39.8628, lon: -4.0273 },
  { name: 'Guadalajara', province: '19', lat: 40.6329, lon: -3.1669 },
  { name: 'Alcalá de Henares', province: '28', lat: 40.4818, lon: -3.3643 },
  { name: 'Logroño', province: '26', lat: 42.4627, lon: -2.445 },
  { name: 'Badajoz', province: '06', lat: 38.8794, lon: -6.9707 },
  { name: 'Huelva', province: '21', lat: 37.2614, lon: -6.9447 },
];

/** Nombres alternativos de provincias (los datos usan «Vizcaya», «Guipúzcoa», «Álava»…). */
export const PROVINCE_ALIASES = {
  48: ['Bizkaia'],
  20: ['Gipuzkoa'],
  '01': ['Araba'],
  '07': ['Baleares', 'Mallorca'],
  15: ['La Coruña'],
  12: ['Castelló'],
  '03': ['Alacant'],
  46: ['València'],
};

/** Ciudades que se ofrecen como atajo, sin escribir. */
export const QUICK_PLACES = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao'];

export { normalize } from './text.js';

/** Distancia aproximada en km entre dos puntos GPS. */
export function km(a, b) {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

/** ¿Está el tren dentro del lugar elegido? */
export function inPlace(train, place) {
  if (!place) return true;
  if (place.kind === 'province') return train.province === place.code;
  return km(train, place) <= CITY_RADIUS_KM;
}
