# Fase 1 · Primer mapa de la red ferroviaria

**Objetivo:** una primera versión visual y funcional donde cualquier ciudadano entienda la red sin conocimientos técnicos.

## Qué se hizo
- Proyecto React + Vite con componentes reutilizables.
- Script `npm run data` que descarga los GTFS oficiales de Renfe Data (alta velocidad, larga y media distancia, y Cercanías)
  y los convierte en JSON ligeros para la web.
- Mapa SVG de España (d3-geo) con el nombre de cada provincia y todas las líneas, cada una con un color suave propio.
- Al pasar el ratón por una línea se resalta y las demás bajan su opacidad; al pulsarla se ven sus paradas.
- Menú superior con «Mapa» y «Billetes».

## Decisiones
- **SVG con d3-geo en lugar de un mapa de teselas:** no depende de servicios externos y permite dibujar provincias y líneas con total control.
- **Colores con el ángulo áureo** (`src/lib/colors.js`): dos líneas consecutivas nunca se parecen y los tonos no son chillones.

## Limitaciones conocidas
- Las líneas de larga y media distancia se dibujaban uniendo estaciones en línea recta (Renfe no publica el trazado de la vía).
