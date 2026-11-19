# Fase 5 · Rediseño de la pestaña Rutas

## Qué se hizo
1. **Mapa y panel en dos tarjetas separadas** (en móvil, el panel va debajo).
2. **Rutas agrupadas por comunidad autónoma** en un acordeón, con un grupo «Internacional». Una ruta aparece en todas
   las comunidades donde para. Los contadores cambian con los filtros y el buscador resalta lo que coincide.
3. **Encuadre con Francia:** la vista inicial incluye todas las rutas, hasta Lyon.
4. **Cercanías por provincia:** al pulsar una provincia el mapa vuela hasta ella y dibuja su red de Cercanías línea a línea,
   con el color oficial de Renfe. Datos: GTFS de Cercanías de Renfe Data (71 líneas, 1.007 estaciones, 24 provincias).
5. **Tipografía Fira Sans** (elegida por el equipo) y Fira Sans Condensed para las etiquetas del mapa.
6. **Paleta con identidad:** azul petróleo de marca, papel cálido de día y noche azulada de noche. Contraste WCAG AA comprobado.
7. **Detalles:** rebote suave al abrir una comunidad, estados vacíos con tono propio y un cargador temático.

## Cómo se asigna cada estación a su comunidad
`scripts/build-data.mjs` comprueba en qué provincia cae cada estación (polígonos a resolución completa) y usa el
**código INE de la provincia** para saber su comunidad autónoma. Las paradas en Francia van al grupo «Internacional».

## Accesibilidad
- Con «reducir movimiento» activado no hay vuelos ni trazados progresivos, solo fundidos cortos.
