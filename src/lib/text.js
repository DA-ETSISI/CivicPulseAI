/** Texto para comparar en buscadores: sin tildes y en minúsculas («Cádiz» → «cadiz»). */
export const normalize = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
