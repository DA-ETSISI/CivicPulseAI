/** Agrupación de las rutas de alta velocidad por comunidad autónoma y búsqueda con resaltado. */

export const INTERNATIONAL = 'Internacional';

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Busca `query` en `text` sin distinguir mayúsculas ni tildes y devuelve los trozos
 * [{ text, match }] para pintar el resaltado. Devuelve null si no hay coincidencia.
 */
export function splitMatch(text, query) {
  const q = strip(query.trim());
  if (!q) return [{ text, match: false }];
  // Se normaliza carácter a carácter para poder volver a las posiciones del texto original.
  let folded = '';
  const origin = [];
  for (let i = 0; i < text.length; i++) {
    const f = strip(text[i]);
    for (let j = 0; j < f.length; j++) {
      folded += f[j];
      origin.push(i);
    }
  }
  const at = folded.indexOf(q);
  if (at < 0) return null;
  const start = origin[at];
  const end = origin[at + q.length - 1] + 1;
  return [
    { text: text.slice(0, start), match: false },
    { text: text.slice(start, end), match: true },
    { text: text.slice(end), match: false },
  ].filter((p) => p.text);
}

export const matchesQuery = (line, query) => {
  const q = strip(query.trim());
  if (!q) return true;
  return strip(`${line.name} ${line.stops.join(' ')} ${line.types.join(' ')}`).includes(q);
};

/**
 * Grupos { name, lines: [{ line, stopsHere, isEnd }] } ordenados alfabéticamente, con «Internacional» al final.
 * Una ruta aparece en todas las comunidades donde para; `isEnd` indica si empieza o termina allí.
 */
export function groupByRegion(lines) {
  const groups = new Map();
  for (const line of lines) {
    const regions = line.regions ?? [];
    regions.forEach((region, i) => {
      if (!groups.has(region.name)) groups.set(region.name, []);
      groups.get(region.name).push({ line, stopsHere: region.stops, isEnd: i === 0 || i === regions.length - 1 });
    });
  }
  return [...groups.entries()]
    .map(([name, items]) => ({
      name,
      // Primero las que empiezan o acaban en la comunidad; después las que solo paran en ella.
      items: items.sort((a, b) => Number(b.isEnd) - Number(a.isEnd) || a.line.name.localeCompare(b.line.name, 'es')),
    }))
    .sort((a, b) => (a.name === INTERNATIONAL) - (b.name === INTERNATIONAL) || a.name.localeCompare(b.name, 'es'));
}
