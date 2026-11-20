import { geoConicConformal, geoDistance, geoMercator, geoPath } from 'd3-geo';

/** Radio medio de la Tierra en km. */
const EARTH_KM = 6371;

/** Distancia real en km entre dos puntos [lon, lat] (sobre la esfera terrestre, no en el plano del mapa). */
export const distanceKm = (a, b) => geoDistance(a, b) * EARTH_KM;

/** Longitud en km de un recorrido que pasa por varios puntos [lon, lat], p. ej. las paradas de un tren. */
export function routeKm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceKm(points[i - 1], points[i]);
  return total;
}

export const WIDTH = 1000;
const PAD = 18;
const CANARY = new Set(['35', '38']);
/** Punto extra para que el encuadre incluya el sur de Francia (la línea a Lyon sigue al hacer zoom). */
const NORTH_EAST = [4.4, 44.25];
/** Margen extra (en px del mapa) para poder desplazarse hacia el norte hasta Lyon con zoom. */
export const NORTH_SLACK = 260;
const COUNTRY_LABELS = [
  { name: 'Portugal', at: [-8.05, 39.75] },
  { name: 'Francia', at: [1.6, 43.85] },
];

/**
 * Proyecciones: península + países vecinos, y Canarias en un recuadro aparte.
 * `fitPoints` ([lon, lat]) amplía el encuadre inicial, p. ej. para que se vean enteras las rutas a Francia.
 */
export function buildGeometry(provinces, countries, fitPoints = [NORTH_EAST], { pad = PAD } = {}) {
  const mainland = provinces.features.filter((f) => !CANARY.has(f.properties.code));
  const canary = { type: 'FeatureCollection', features: provinces.features.filter((f) => CANARY.has(f.properties.code)) };
  const portugal = countries.features.filter((f) => f.properties.name === 'Portugal');
  const target = {
    type: 'FeatureCollection',
    features: [...mainland, ...portugal, { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: fitPoints } }],
  };

  const projection = geoConicConformal().parallels([37, 44]).rotate([3, 0]).fitWidth(WIDTH - 2 * pad, target);
  const [[x0, y0], [, y1]] = geoPath(projection).bounds(target);
  const [tx, ty] = projection.translate();
  projection.translate([tx + pad - x0, ty + pad - y0]);
  const height = Math.round(y1 - y0 + 2 * pad);

  const inset = { x: PAD, y: height - PAD - 92, w: 200, h: 92 };
  const insetProjection = geoMercator().fitExtent(
    [
      [inset.x + 10, inset.y + 16],
      [inset.x + inset.w - 10, inset.y + inset.h - 8],
    ],
    canary,
  );

  return { projection, path: geoPath(projection), insetPath: geoPath(insetProjection), height, inset };
}

/** Formas de provincias, países y etiquetas, ya proyectadas. */
export function buildBase(provinces, countries, geo) {
  const provinceShapes = provinces.features.map((f) => {
    const p = CANARY.has(f.properties.code) ? geo.insetPath : geo.path;
    const [x, y] = p.centroid(f);
    return {
      name: f.properties.name,
      code: f.properties.code,
      ccaa: f.properties.ccaa ?? null,
      hasNetwork: Boolean(f.properties.cercanias),
      d: p(f),
      bounds: p.bounds(f),
      x,
      y,
      size: Math.max(7.5, Math.min(11, Math.sqrt(p.area(f)) / 9)),
    };
  });
  const countryShapes = countries.features.map((f) => ({ name: f.properties.name, d: geo.path(f) }));
  const countryLabels = COUNTRY_LABELS.map((c) => {
    const [x, y] = geo.projection(c.at);
    return { ...c, x, y };
  });
  return { provinceShapes, countryShapes, countryLabels };
}
