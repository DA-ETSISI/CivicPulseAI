# Fase 4 · RadarDeTrenes y seguimiento de trenes

**Fuente:** [RadarDeTrenes](https://radardetrenes.com/openapi.json), API pública y gratuita que reúne datos abiertos de Renfe y ADIF.
No es una fuente oficial: en la web se citan las dos (RadarDeTrenes y el origen Renfe/ADIF).

## Qué se hizo
- **Servidor con caché** (`server/index.mjs`): algunos endpoints a veces tardan o fallan, así que se guardan copias,
  se reintenta y, si falla, se usa la última copia buena.
- **Incidencias:** posición de todos los trenes cada 20 s con movimiento suave, retraso oficial, avisos de toda la red
  y cancelaciones. Al pulsar un tren: seguimiento en el mapa, recorrido real, próxima parada, velocidad y evolución del retraso.
- **Rutas:** el servidor aprende el trazado real de cada tren de larga distancia mientras circula (`.cache/routes.json`)
  y `npm run data` lo guarda en el mapa.
- **Billetes:** cada tren muestra su puntualidad de los últimos 30 días y, si circula hoy, su retraso actual.

## Regla del GPS
La API no da el estado «parado / en movimiento», así que se deduce: parado a menos de 400 m de una estación,
en camino a menos de 1,5 km de la siguiente, en movimiento en el resto. La regla de retraso de la fase 3 se mantiene.
