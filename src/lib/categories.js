/** Tipos de servicio que se pueden filtrar en el mapa (orden = orden de dibujo). */
export const CATEGORIES = [
  { id: 'md', label: 'Media distancia', hint: 'Regionales entre ciudades cercanas', width: 1.2 },
  { id: 'ld', label: 'Larga distancia', hint: 'Intercity y trenes convencionales', width: 1.5 },
  { id: 'cer', label: 'Cercanías', hint: 'Cercanías y Rodalies metropolitanos', width: 1.3 },
  { id: 'av', label: 'Alta velocidad', hint: 'AVE, AVANT, AVLO, Euromed', width: 2.1 },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
