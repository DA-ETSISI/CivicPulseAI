# Fase 7 · Remates de línea y líneas en servicio (Rutas)

## Decisiones tomadas con el equipo antes de empezar
- El estado «en servicio / sin servicio» se aplica a **Cercanías y también a la alta velocidad**.
- Una línea está **en servicio** si la hora actual (Europe/Madrid) cae dentro de su **horario de servicio de hoy**,
  entre su primer tren y el último, según el calendario oficial de Renfe (con festivos).
- En una provincia salen **enteras las líneas que la tocan** (con alguna estación dentro).
- Las provincias **sin Cercanías no reaccionan**: no se iluminan ni se pueden pulsar; solo muestran un texto al pasar el ratón.
- Los colores de Cercanías son los **oficiales del GTFS** (`route_color`): las 71 líneas lo tienen.

## 1. Remates de inicio y fin
- Se quitó el marcador agrupado con anillos de colores. Cada línea termina en un **círculo del mismo diámetro que su
  trazo**, del mismo tono pero más oscuro (`color-mix` en OKLCH con un 38 % de negro).
- Si varias líneas acaban en la misma estación, cada una lleva su remate y se tapan según el orden de dibujo.
- El remate iguala el grosor también con zoom: como las líneas tienen grosor fijo en pantalla, el radio se calcula
  con el zoom y con la escala real del mapa en pantalla (`useSvgScale` en `RailMap.jsx`).
- Las paradas intermedias son anillos algo mayores que el trazo.

## 2–4. Líneas en servicio
- **Datos** (`scripts/build-data.mjs`): para cada línea y cada día se guarda su horario de servicio en **tramos**
  `[inicio, fin]` (minutos desde medianoche). Si hay más de 2 h 30 min sin trenes (la noche), el horario se corta.
  Un tren que acaba de madrugada alarga el día anterior (fin mayor que 1440).
  - Alta velocidad: 90 días desde hoy (calendar + calendar_dates del GTFS de alta velocidad).
  - Cercanías: los 30 días que cubre su calendario. Más allá se muestra «Sin datos de horario», no «sin servicio».
- **Cálculo** (`src/lib/serviceStatus.js`): se recalcula cada minuto sin recargar la página.
- **Mapa:** las líneas sin servicio se dibujan al 30 % de opacidad. El tooltip lo dice en texto:
  «Sin servicio ahora · Próximo tren 05:50» o «En servicio ahora».
- **Listas:** en el acordeón, el buscador y el panel de la provincia, primero las líneas en servicio; debajo, tras el
  separador «Sin servicio ahora», el resto con su próximo tren. El texto apagado usa el color `--muted`, que cumple
  4.5:1 con el fondo en los dos temas.
- **Provincia sin ningún tren circulando:** aviso arriba del panel («Ahora mismo no circula ningún tren en esta red.
  Primer tren a las 04:55.»).

## Probar a otra hora
Añade `?hora=HH:MM` (y si quieres `&fecha=AAAA-MM-DD`) a la dirección, antes de `#/rutas`:

```
http://localhost:5173/?hora=03:00#/rutas
```

En la barra del mapa aparece «Hora simulada» para que no se confunda con la hora real.

## Comprobado
A las 03:00, 08:00 y 23:30, en escritorio y móvil, temas claro y oscuro: remate de 3,6 px igual al trazo (también
con zoom ×7), orden de las listas, aviso de la provincia, Huesca sin reacción, buscador, filtros y zoom.
