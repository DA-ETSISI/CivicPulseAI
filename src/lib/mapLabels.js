/**
 * Utilidades de cartografía para el mapa de Rutas:
 * - colocar las etiquetas de las paradas sin que se solapen;
 * - localizar las ciudades cabecera con muchas líneas (para rotular solo las principales).
 *
 * Todo se calcula en píxeles de pantalla y se convierte a unidades del mapa dividiendo por el zoom `k`,
 * para que las etiquetas tengan siempre el mismo tamaño en pantalla.
 */

export const LABEL_FONT_PX = 13;
const MARKER_PX = 5;
const GAP_PX = 4;

let ctx = null;
const widthCache = new Map();

/** Ancho real del texto con la fuente de las etiquetas (Fira Sans Condensed). */
export function measureLabel(text) {
  if (widthCache.has(text)) return widthCache.get(text);
  ctx ??= document.createElement('canvas').getContext('2d');
  ctx.font = `600 ${LABEL_FONT_PX}px 'Fira Sans Condensed', 'Fira Sans', sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width);
  widthCache.set(text, w);
  return w;
}
export const clearLabelCache = () => widthCache.clear();

const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

// Posiciones de prueba alrededor del marcador, en orden de preferencia (derecha, izquierda, arriba, abajo, diagonales).
const DIRECTIONS = [
  [1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 1], [-1, -1], [-1, 1],
];
const RINGS = [1, 2.6, 4.4, 6.5];

/**
 * Coloca una etiqueta por parada sin solapes. `points` son [x, y] en unidades del mapa.
 * Devuelve, para cada parada: { x, y, anchor, leader } (leader = línea guía si la etiqueta se ha alejado).
 * Las cabeceras y la parada resaltada se colocan primero para que tengan la mejor posición.
 * Opciones: `sizes[i]` = tamaño en px de cada etiqueta (por defecto LABEL_FONT_PX) y `optional` = Set de
 * índices que, si no caben sin solaparse, se quedan sin etiqueta (null) en vez de montarse sobre otra.
 * `bounds` = { x0, y0, x1, y1 } visible (unidades del mapa): se evitan posiciones que se saldrían del encuadre.
 */
export function placeLabels(points, names, k, priority = [], { sizes = null, optional = null, bounds = null } = {}) {
  const s = 1 / k;
  const order = [...new Set([...priority, ...points.map((_, i) => i)])].filter((i) => points[i]);
  const markers = points.map(([x, y]) => ({ x0: x - MARKER_PX * s, x1: x + MARKER_PX * s, y0: y - MARKER_PX * s, y1: y + MARKER_PX * s }));
  const placed = [];
  const result = new Array(points.length);

  for (const i of order) {
    const [px, py] = points[i];
    const fontPx = sizes?.[i] ?? LABEL_FONT_PX;
    const w = measureLabel(names[i]) * (fontPx / LABEL_FONT_PX) * s;
    const h = (fontPx + 2) * s;
    let best = null;

    for (const ring of RINGS) {
      for (const [dx, dy] of DIRECTIONS) {
        const off = (MARKER_PX + GAP_PX) * ring * s;
        const cx = px + dx * off;
        const cy = py + dy * off;
        // Caja de la etiqueta según hacia dónde se aleja del marcador.
        const x0 = dx > 0 ? cx : dx < 0 ? cx - w : cx - w / 2;
        const y0 = dy > 0 ? cy : dy < 0 ? cy - h : cy - h / 2;
        const box = { x0: x0 - 1.5 * s, x1: x0 + w + 1.5 * s, y0: y0 - 1 * s, y1: y0 + h + 1 * s };
        const outside = bounds && (box.x0 < bounds.x0 || box.x1 > bounds.x1 || box.y0 < bounds.y0 || box.y1 > bounds.y1);
        const blocked = outside || placed.some((b) => overlaps(box, b)) || markers.some((m, j) => j !== i && overlaps(box, m));
        if (!blocked) {
          best = { box, x: x0, y: y0 + h / 2, ring, cx, cy };
          break;
        }
      }
      if (best) break;
    }
    // Si no hay hueco libre (zonas muy densas), se usa el anillo más lejano con línea guía.
    if (!best && optional?.has(i)) {
      result[i] = null;
      continue;
    }
    if (!best) {
      const off = (MARKER_PX + GAP_PX) * RINGS.at(-1) * s;
      const x0 = px + off;
      best = { box: { x0, x1: x0 + w, y0: py - h / 2, y1: py + h / 2 }, x: x0, y: py, ring: RINGS.at(-1), cx: x0, cy: py };
    }
    placed.push(best.box);
    result[i] = {
      x: best.x,
      y: best.y,
      leader: best.ring > 1 ? [px, py, best.cx, best.cy] : null,
    };
  }
  return result;
}

const cityOf = (stopName) => stopName.split(/\s*-\s*/)[0].trim();

/**
 * Agrupa los extremos de las líneas que caen en el mismo sitio (a menos de `thresholdPx` en pantalla).
 * Devuelve [{ x, y, colors: [...], lineIds: [...], city }] ordenado de menos a más líneas.
 */
export function groupTerminals(shapes, k, thresholdPx = 11) {
  const t = thresholdPx / k;
  const groups = [];
  for (const { line, stops } of shapes) {
    if (stops.length < 2) continue;
    const ends = [
      { p: stops[0], name: line.stops[0] },
      { p: stops.at(-1), name: line.stops.at(-1) },
    ];
    for (const end of ends) {
      if (!end.p) continue;
      const [x, y] = end.p;
      let g = groups.find((gr) => Math.hypot(gr.x - x, gr.y - y) < t);
      if (!g) groups.push((g = { x, y, colors: [], lineIds: [], names: [] }));
      if (g.lineIds.includes(line.id)) continue;
      g.lineIds.push(line.id);
      g.colors.push(line.color);
      g.names.push(end.name);
    }
  }
  for (const g of groups) {
    const counts = new Map();
    for (const n of g.names) counts.set(cityOf(n), (counts.get(cityOf(n)) ?? 0) + 1);
    g.city = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  return groups.sort((a, b) => a.lineIds.length - b.lineIds.length);
}
