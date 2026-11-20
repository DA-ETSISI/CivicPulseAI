# Fase 11 · Fronteras, islas y formulario en móvil

## Qué se ha cambiado

1. **Fronteras España–Portugal–Francia–Andorra.** Las provincias (IGN, vía click_that_hood) y los países vecinos (Natural Earth, vía world-atlas) venían de fuentes distintas, así que sus bordes no coincidían: había huecos y solapes en la raya. Ahora los países vecinos llegan justo hasta la silueta de las provincias. Se aplica a todos los mapas, porque todos leen `public/data/countries.json`.
2. **Vías.** La red ferroviaria se corta exactamente en la frontera, sin quedarse a medias ni meterse en Portugal o Francia. También se han quitado las vías de Baleares y Canarias (no son de Renfe). Afecta a `railways-es.geojson` y `lineas-es.geojson`.
3. **Formulario de billetes en móvil.** En iPhone, Safari daba a los campos de fecha un ancho mínimo propio y se salían de la tarjeta. Ahora ocupan el mismo ancho que el resto. Además, los campos usan 16px en móvil para que iOS no haga zoom al tocarlos (`src/index.css`).

## Cómo regenerarlo

`npm run data` y `node scripts/build-railways.mjs` sobrescriben esos archivos. Después hay que volver a ejecutar:

```
node scripts/fit-borders.mjs public/data 6
```

Necesita `polygon-clipping` y `@turf/buffer` (ver la cabecera del script).

## Transiciones entre secciones de la portada

Antes, solo «Billetes» tenía animación, y solo la primera vez que aparecía. Ahora la portada (foto de VíaClara), el mapa y los billetes usan la misma transición en los dos sentidos: aparecen al llegar (fundido y subida suave) y desaparecen al irse.

- `src/lib/useInView.js`: hook reutilizable. Devuelve `true` mientras la sección cruza la franja central de la pantalla (del 35% al 65%) y `false` cuando sale de ella.
- Se aplica con las clases que ya existían, `.reveal` / `.is-visible`, en `Hero.jsx`, `LiveMapSection.jsx` y `TicketsPage.jsx`.
- Con «reducir movimiento» activado en el sistema no hay animación (regla ya existente en `index.css`).

## Pestañas con deslizamiento (Incidencias)

- `src/components/SlideTabs.jsx`: componente reutilizable de pestañas tipo píldora. El fondo turquesa se desliza (y cambia de ancho) hasta la opción elegida.
- Al cambiar de pestaña, el contenido entra deslizándose desde el lado de la opción elegida: desde la derecha si avanzas, desde la izquierda si vuelves (`.tab-panel.slide-next` / `.slide-prev` en `compensation.css`).
- Se usa en «Estado en directo / Compensaciones y derechos» (`IncidentsPage.jsx`). Duración: 0,35 s.

## Mapa: vuelve el clic → ver línea, doble clic → billete

- La red ferroviaria de fondo (OpenStreetMap) vuelve a ser **solo visual**. Su zona invisible de hover tapaba las líneas de Renfe, y el clic ya no ofrecía comprar billete. Ahora, como antes: clic en una línea = se resalta y aparece «Comprar billete»; doble clic = baja a Billetes con origen y destino rellenos y busca los trenes.
- Ya no se descarga `lineas-es.geojson` (el archivo se queda en `public/data` por si se vuelve a usar).
- Corregido un error introducido con las transiciones: `TicketsPage` llamaba a `setVisible`, que ya no existía, y la página se rompía al llegar desde el mapa.

## Botones «Solo ida / Ida y vuelta»

Al pulsarlos se hunden un poco (`:active`) y la opción elegida hace un pequeño rebote (`@keyframes trip-pop` en `index.css`).

## Filtros AVE / AVLO / Euromed (Rutas)

- Usan la misma animación suave que «Solo ida / Ida y vuelta»: se hunden un poco al pulsarlos, la opción activada crece suavemente y el punto turquesa se agranda al encenderse.
- Antes, si AVE era el único tipo activo, pulsarlo no hacía nada (no se podía dejar el mapa vacío). Ahora, pulsar el único tipo activo vuelve a mostrar los tres (`MapPage.jsx`).

## Punto verde «en línea» en AVE / AVLO / Euromed

El punto de cada filtro es verde (#22c55e) y late suavemente cuando el tipo está activo, como un indicador «online». Cuando se apaga, el punto queda gris y más pequeño (`.chip-dot` en `index.css`).

## Red de fondo: solo vías con trenes de viajeros

`scripts/build-railways.mjs` ahora descarga de OpenStreetMap solo las vías:
- que forman parte de una ruta de trenes de viajeros (`route=train`), o
- que están marcadas como de viajeros o mixtas,

en ancho ibérico, estándar y métrico (líneas de la costa cantábrica, FGC, Euskotren), sin vías de servicio ni tramos de solo mercancías. La red pasa de ~19.800 km a ~17.000 km. Si el servidor principal de Overpass está saturado, el script prueba dos servidores espejo.

Después hay que recortarla con `scripts/fit-borders.mjs`, como se explica arriba.

Limitación: OpenStreetMap no tiene horarios. Algún tramo corto con viajeros puede faltar si en OSM no está en ninguna ruta ni marcado como de viajeros.
