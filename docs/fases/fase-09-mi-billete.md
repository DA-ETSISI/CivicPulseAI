# Fase 9 · Mi billete, mapa de Rutas más grande y detalles del panel

## Decisiones tomadas con el equipo antes de empezar
- Se guardó y subió antes la fusión con `mapaBilletes` (portada, mapa en directo y compra desde el mapa).
- **Mi billete** es una página propia (como Incidencias), con su botón el último del menú y su propio mapa.
- El color de cada comunidad en el acordeón es el de su **ruta principal** (la que tiene más trenes).
- Un billete es **un viaje con transbordos** (uno o varios trenes encadenados), sin ida y vuelta.
- Regla general: **solo trenes** (AVE, AVLO, Euromed, Alvia, Intercity, AVANT, Regionales, Cercanías).
  Los horarios de Renfe que usamos no contienen autobuses, y Cercanías ya descartaba las rutas `BUS`.

## 1. Mapa de Rutas más grande y bien encuadrado
- En escritorio el mapa ocupa al menos el **70 % del alto de la pantalla** y todo el ancho que deja el panel;
  el SVG se ajusta sin deformarse.
- El encuadre inicial se calcula con **todas las paradas y trazados de todas las rutas** (Francia incluida) y un
  margen amplio: ningún remate ni etiqueta queda cortado. El botón de reset vuelve a este encuadre.
- Las etiquetas de ciudad no se pisan: si chocan, gana la cabecera con más líneas. Los nombres de provincia que
  quedarían debajo de una ciudad rotulada se ocultan.

## 2. Mi billete (`src/pages/MyTicketPage.jsx`)
- **Entrada manual:** fecha y número de cada tren; las estaciones solo si hace falta desambiguar.
  «+ Añadir otro tren» para los transbordos.
- **Escanear QR:** la cámara (trasera) solo se enciende al pulsar «Escanear billete» y se apaga al leer o cancelar.
  Usa `BarcodeDetector` si el navegador lo tiene y, si no, `jsQR` (se descarga solo en ese momento).
  También se puede subir una foto o captura.
- **Itinerario:** cada tramo con salida, llegada, número de tren y tipo; los transbordos destacados
  («Transbordo en Cuenca-Fernando Zóbel · 17 min para cambiar al tren 05064»), en amarillo si es ajustado y
  en rojo si el retraso lo pone en riesgo.
- **Cuenta atrás** en vivo hasta el siguiente tren (cada segundo). Cambia de estilo con menos de 15 min o si el
  transbordo es ajustado.
- **Retrasos en tiempo real** (solo si el viaje es hoy): se consultan a nuestro servidor solo por número de tren.
- **Avisos del navegador** opcionales (5, 10, 15 o 30 min antes de cada salida) mientras la página está abierta.
- **Mapa** con el trayecto: cada tramo de un color y rotuladas las estaciones de origen, transbordo y destino.
- **Ejemplo:** «Ver un ejemplo con transbordo» busca en los horarios reales un viaje con transbordo.

### Privacidad
- Todo ocurre en el dispositivo. El itinerario se reconstruye con los horarios de Renfe ya descargados
  (`timetable.json`): el billete y el QR no se envían a ningún servidor.
- **Minimización** (`src/lib/qrTicket.js`): del QR solo se leen número de tren, fecha, estaciones y, si vienen,
  coche y plaza (estos dos se muestran pero nunca se guardan). Nombre, DNI, email, teléfono, localizador, precio y
  cualquier otro dato no se leen ni se copian.
- Si el QR va cifrado o en un formato no público, **no se intenta descifrar**: se explica y se pasa a la entrada manual.
- Por defecto no se guarda nada. «Recordar este viaje en este dispositivo» guarda solo fecha, números de tren y
  estaciones en `localStorage`; se borra solo al terminar el viaje y con el botón «Borrar mi billete».
- No hay analítica, registros ni rastreadores.

## 3. Aviso en rojo para provincias sin Cercanías
Al pulsar una provincia sin red aparece «Huesca: esta provincia no tiene red de Cercanías.» con icono de aviso,
fondo rojo tenue y texto y borde rojos (tokens `--danger`, `--danger-ink`, `--danger-soft`). Contraste del
texto: 7,5:1 en claro y 9,1:1 en oscuro.

## 4. Hover en las comunidades del acordeón
Cada cabecera crece un 3 % (con `transform`, sin mover a las vecinas) y toma el color de su ruta principal
(fondo tenue y contorno), en 180 ms con ease-out. Igual con el foco del teclado. Con «reducir movimiento» solo
cambia el color. Es solo visual: no resalta ninguna línea del mapa.

## Comprobado
Escritorio y móvil (375 px), temas claro y oscuro: billete de ejemplo con transbordo, entrada manual con dos
trenes, QR legible con datos personales falsos (no aparecen en pantalla, ni se guardan, ni salen en ninguna
petición), QR cifrado (pasa a manual), cámara que se enciende y se apaga, guardar y borrar el billete, mapa de
700 px de alto sin elementos cortados, etiquetas sin solapes, aviso rojo y hover sin efecto en el mapa.

## Modo demo (solo en desarrollo)

Para enseñar y probar cada situación sin esperar a que ocurra de verdad.

- **Cuándo aparece:** solo con `npm run dev` (`import.meta.env.DEV`). En el build de producción el import dinámico desaparece, así que ni el fixture ni la barra de demo llegan a la web publicada.
- **Datos:** `src/dev/mi-billete-demo.json`, con trenes, horarios y vías inventados. Las estaciones son reales solo para poder dibujar el mapa. No hay datos personales.
- **Cómo abrirla:**
  - el enlace «Ver un ejemplo con transbordo» carga el escenario *normal*;
  - `?demo=1` o `?demo=<escenario>` la abre directamente (por ejemplo `http://localhost:5173/?demo=perdido&hora=11:20#/mi-billete`).
- **Escenarios:** normal, retraso leve, retraso que pone en riesgo el transbordo, transbordo perdido, tren cancelado, cambio de vía, viaje con 2 transbordos, tren ya salido y viaje terminado.
- **Reloj simulado:** `?hora=HH:MM` o el control deslizante de la barra. La cuenta atrás sigue corriendo desde esa hora.
- **Sin pantallas falsas:** cada escenario se carga como itinerario y lo pintan los componentes reales (`Countdown`, `IncidentPanel`, `Itinerary`, `TicketMap`). Para ello la UI real aprendió tres casos nuevos: tren cancelado, cambio de vía y transbordo ya perdido.
- **Aislada de lo guardado:** la demo no lee ni toca lo guardado en el dispositivo, no consulta retrasos en directo y no lanza avisos del navegador.

## Menú: subrayado deslizante

La pestaña activa tiene un único subrayado (`.nav-indicator`) que se desliza hasta la nueva pestaña con `transform: translateX` y `width` (250 ms, ease-out). Se recoloca si cambia el tamaño. Con `prefers-reduced-motion` salta sin animación.

## Mapa de Mi billete: progreso del viaje y todas las paradas

- **Progreso:** solo se colorea lo ya recorrido; lo que falta va en gris tenue. Un punto marca la posición estimada del tren, calculada con el horario, el retraso y la hora actual (o la del reloj simulado de la demo). Entre dos paradas se interpola y, mientras el tren está parado, el punto se queda en la estación.
- **Paradas:** se rotulan todas. Las intermedias van a 13 px y el origen, los transbordos y el destino a 15 px. Las ya pasadas salen apagadas.
- **Sin solapes:** `placeLabels` acepta ahora un tamaño por etiqueta (`sizes`), etiquetas opcionales (`optional`, que se ocultan si no caben y aparecen al hacer zoom) y la zona visible (`bounds`, para que ninguna se salga del borde).
- **Tamaños reales:** las etiquetas se miden en px de pantalla (zoom × escala del SVG), así que miden lo mismo en móvil y en escritorio.

## Rutas: etiquetas más grandes

Las ciudades del mapa pasan a 13 px y las paradas de la línea seleccionada también (antes, 12 y 11 px en unidades del mapa, que en pantalla quedaban algo más pequeñas). Las paradas intermedias que no caben sin solaparse se ocultan hasta acercar el zoom.
