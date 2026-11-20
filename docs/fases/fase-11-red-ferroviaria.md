# Fase 11 · Red ferroviaria de fondo en el mapa en directo

## Qué se ha hecho

Debajo de los trenes del mapa en directo de la portada (`TrainMap`) aparece ahora toda la red ferroviaria de España. Las líneas se pueden señalar y fijar.

- **Hover:** la línea se resalta en turquesa (`#3fd6c6`, 3 px) y un tooltip sigue al ratón con su nombre.
- **Clic:** fija la línea resaltada. Se suelta con otro clic en la misma línea o en el mapa. Pueden coexistir una línea fijada y otra en hover.
- **Sin cambios en lo demás:** las vías de alta velocidad (clic = ver, doble clic = comprar billete) y los trenes (clic = detalle, doble clic = comprar) siguen igual y quedan **por encima** de la red, así que tienen prioridad al pulsar.
- Los bordes de provincia de este mapa pasan a opacidad 0,5 para que la red se lea mejor.
- Atribución «Vías © OpenStreetMap» arriba a la derecha.

## Capas (de abajo arriba)

1. `rail-net-base`: red completa (`railways-es.geojson`) en `#d9b97a`, opacidad 0,55, 1,25 px, extremos redondeados. No es interactiva.
2. `rail-net-hits`: un trazo invisible de 12 px por línea con nombre (`lineas-es.geojson`). Es la zona que capta el ratón.
3. `rail-net-active`: la línea en hover y la fijada.
4. Encima, sin cambios: las vías AV, las etiquetas y los trenes.

Los grosores usan `vector-effect: non-scaling-stroke` y miden lo mismo con cualquier zoom.

## Datos

`scripts/build-railways.mjs` descarga de OpenStreetMap (API Overpass) las vías `railway=rail` de uso principal o secundario de España. Después:

- une los tramos contiguos;
- los simplifica (Douglas–Peucker) y redondea las coordenadas a 3 decimales;
- genera `public/data/railways-es.geojson` (≈63 KB, MultiLineString) y `public/data/lineas-es.geojson` (≈71 KB, 112 líneas con `properties.n`). Si una vía tiene nombre en castellano (`name:es`), se usa ese.

```
node scripts/build-railways.mjs          # usa la caché .cache/osm-railways.json
node scripts/build-railways.mjs --fresh  # descarga de nuevo
```

Datos © colaboradores de OpenStreetMap (licencia ODbL).

## Archivos

- `src/components/live/RailNetwork.jsx`: las tres capas y sus eventos.
- `src/lib/useRailways.js`: descarga los dos GeoJSON una sola vez. Si fallan, el mapa funciona sin ellos.
- `src/components/live/TrainMap.jsx`: incluye la capa, la línea fijada, el tooltip y la atribución.
- `src/styles/home.css`: estilos de la red y de la atribución.

## Nota de entorno

En este PC Vite no arrancaba («Cannot read directory ../../..: Access is denied»). La carpeta `C:\Users` tenía alterados los permisos de Windows y esbuild no podía leerla. Se le añadieron los permisos estándar (lectura para Usuarios y Todos, control total para SYSTEM).
