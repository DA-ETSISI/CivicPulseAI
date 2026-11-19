# Fase 8 · Compensaciones y derechos del pasajero (Incidencias)

Rama `compensaciones`. La pestaña **Incidencias** tiene ahora dos apartados: **«Estado en directo»** (lo que ya
había) y **«Compensaciones y derechos»**.

## Decisiones tomadas con el equipo antes de empezar
- Es un apartado **dentro de Incidencias**, no una pestaña nueva del menú.
- El pasajero introduce los datos de su billete: **origen, destino, hora de salida, llegada prevista y llegada real**.
- Además de la calculadora, una **guía sencilla** para reclamar con **enlaces a las páginas oficiales**.

## 1. Normas que aplica
Sacadas directamente de la página oficial de Renfe (revisada en noviembre de 2026), porque otras webs daban cifras
distintas para Avant y Media Distancia:

| Tren | Devolución |
|---|---|
| AVE, Avlo, Euromed, Alvia, Intercity | 50 % con 60 min o más · 100 % con más de 90 min |
| Avant | 50 % con más de 15 min · 100 % con más de 30 min |
| Regional | 25 % / 50 % / 100 % con más de 30 / 45 / 60 min |
| Avant + Avant, Avant + Regional, Regional + Regional | 50 % con más de 30 min · 100 % con más de 60 min |
| Otros billetes con enlace | 50 % con más de 60 min · 100 % con más de 90 min |
| AVE España–Francia | Tramo español como Larga Distancia; tramo francés e internacional con sus propios tramos |
| Cercanías | Sin devolución por retraso (justificante de retraso y reclamación) |

- **Mínimo europeo** (Reglamento UE 2021/782, art. 19): 25 % con 60–119 min y 50 % con 120 min o más. No se suma al
  de Renfe: se aplica **el que sea más favorable** para el viajero.
- **Fuerza mayor** (art. 19.10): no hay indemnización.
- **Limitaciones de velocidad de Adif**: Renfe no indemniza los billetes comprados desde el 31/01/2026. La ley europea
  no considera fuerza mayor los problemas de la infraestructura, así que se muestra el mínimo europeo.
- **Plazo**: desde 24 h después de la llegada hasta 3 meses después del viaje.
- **Formas de cobro** (solo AVE y Larga Distancia nacionales, no Avlo ni internacionales): misma forma de pago, código
  de descuento con un 50 % más o Puntos Renfe con un 100 % más.

## 2. Calculadora
- **Formulario** (`CompensationForm.jsx`): origen y destino con el mismo autocompletado de estaciones que Billetes
  (`StationInput` + horarios de Renfe; si no cargan, campos de texto), tipo de tren, nº de tren, fecha, precio,
  las tres horas y la causa del retraso.
- **Resultado** (`CompensationResult.jsx`), al momento y sin botón de enviar:
  - retraso, porcentaje e importe en euros;
  - una barra con los tramos y la posición del retraso;
  - formas de cobro con su importe, el aviso de plazo (abierto, aún no o vencido) y el siguiente tramo;
  - botones **«Solicitar en renfe.com»** y **«Copiar datos del viaje»** (texto listo para pegar en el formulario de Renfe).
- Funciona con viajes que **pasan de medianoche** y avisa si las horas no tienen sentido.

## 3. Guía y derechos
- `ClaimGuide.jsx`: 6 pasos, del billete a la oficina de consumo, con enlaces a **Solicita indemnización** y
  **Tramita tu reclamación** de renfe.com.
- `PassengerRights.jsx`: reembolso o tren alternativo, comida y bebida, alojamiento, indemnización mínima y
  cuándo no hay indemnización.
- Todos los enlaces oficiales están juntos en `src/components/compensation/links.js`.

## Dónde está el código
```
src/lib/compensation.js          Normas y cálculos (lógica pura, sin React)
src/lib/compensation.test.js     13 pruebas automáticas (npm test)
src/components/compensation/     Formulario, resultado, guía, derechos y enlaces
src/styles/compensation.css      Estilos del apartado y de las pestañas
src/pages/IncidentsPage.jsx      Pestañas «Estado en directo» / «Compensaciones y derechos»
```

## Comprobado
- `npm test`: 13 pruebas, todas pasan. Una de ellas encontró un fallo (salida y llegada prevista a la misma hora se
  entendía como un viaje de 24 h), ya corregido.
- En el navegador, en escritorio y en móvil (390 px), sin errores en consola ni scroll lateral. Ejemplo: AVE de
  58,40 €, salida 08:00, llegada prevista 10:32 y real 12:10 → 1 h 38 min de retraso, **100 % (58,40 €)**.
- Tras juntar `main` (servidor RadarDeTrenes), el apartado «Estado en directo» sigue funcionando igual.

## Fuentes
- [Compromiso de puntualidad de Renfe](https://www.renfe.com/es/es/ayuda/compromiso-puntualidad)
- [Solicita indemnización (Renfe)](https://www.renfe.com/es/es/gestiona-tu-billete/posventa/solicita-indemnizacion)
- [Reglamento (UE) 2021/782](https://eur-lex.europa.eu/eli/reg/2021/782/oj?locale=es)
