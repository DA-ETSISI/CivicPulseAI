# Fase 6 · Paradas, cabeceras y corrección del acordeón (Rutas)

## 1. Hover sin animación
Pasar el ratón por una línea ya no anima nada: la línea se ve un poco más gruesa y las demás bajan su opacidad al
instante. Se quitó el tren que recorría la línea.

## 2. Nombres de las paradas
- Con el ratón sobre **cualquier parada** de una línea aparecen los nombres de **todas** sus paradas; al salir, desaparecen.
- Al **pulsar** la línea, los nombres quedan fijos hasta deseleccionarla (otra línea, fondo del mapa o tecla Esc).
- **Sin solapes:** `src/lib/mapLabels.js` mide el ancho real de cada nombre y prueba varias posiciones alrededor de la
  parada (derecha, izquierda, arriba, abajo, diagonales y más lejos con línea guía) hasta encontrar un hueco libre.
  Primero se colocan las cabeceras y la parada resaltada.

## 3. Resaltar una parada
- Las paradas se pueden pulsar en el mapa y en la lista del panel. La elegida se ve más grande, con un anillo del color
  de la línea y el nombre en negrita; las demás se atenúan. Pulsar otra cambia el resalte; pulsar la misma lo quita.
- Teclado: Tab para llegar a la parada y Enter o Espacio para elegirla, con foco visible.

## 4. Inicio y final de cada línea
- En la vista general cada línea marca sus dos cabeceras con un círculo relleno de su color (las paradas intermedias
  son anillos huecos).
- Si varias líneas comparten cabecera (Madrid, Barcelona…), se agrupan en **un único marcador con sectores** de los
  colores de cada línea y un pequeño contador. Solo las cabeceras con 5 líneas o más llevan el nombre de la ciudad.

## 5. Corrección: el acordeón marcaba líneas sin querer
- **Causa:** la lista de una comunidad plegada conservaba 8 px de margen inferior, así que entre dos cabeceras asomaba
  una franja de la primera ruta oculta que recibía el ratón.
- **Solución:** sin margen en la lista plegada, contenido `inert` (ni ratón ni foco) y `visibility: hidden`, también
  durante la animación de cierre. Pasar por una cabecera no hace nada en el mapa; pasar por una ruta visible solo la
  previsualiza.

## Táctil
Un toque sobre una línea o una parada la previsualiza con los nombres; un segundo toque la fija.

## Comprobado
Escritorio y móvil, temas claro y oscuro: sin solapes de etiquetas, resalte desde mapa, panel y teclado, Esc,
filtros AVE/AVLO/Euromed, buscador y zoom con la rueda.
