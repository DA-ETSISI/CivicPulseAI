/**
 * Paleta suave: tonos repartidos con el ángulo áureo para que dos líneas
 * consecutivas nunca se parezcan, con saturación moderada para no cansar la vista.
 * En modo oscuro los mismos tonos se aclaran para que se lean sobre fondo oscuro.
 */
const GOLDEN_ANGLE = 137.508;
const LIGHTNESS = [44, 52, 38];
const SATURATION = [42, 36, 48];

export function lineColor(index, theme = 'light') {
  const hue = (index * GOLDEN_ANGLE + 200) % 360;
  const band = index % 3;
  const dark = theme === 'dark';
  const s = SATURATION[band];
  const l = LIGHTNESS[band] + (dark ? 16 : 0);
  return `hsl(${hue.toFixed(1)} ${s}% ${l}%)`;
}
