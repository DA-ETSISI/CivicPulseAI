# Fase 10 · Huella de carbono: ahorro de CO₂ frente al coche (Billetes)

Rama `ecofriendly`. Al elegir un billete, el **resumen de compra** muestra, debajo del precio, cuántos kilos de
CO₂ ahorras haciendo ese trayecto en tren en lugar de en coche particular.

## Decisiones tomadas con el equipo antes de empezar
- Factores de emisión **oficiales** (ministerio de transición ecológica o agencias europeas).
- Distancias **reales entre estaciones**, calculadas en `mapGeometry.js`.
- Va en **Billetes**, en el resumen de compra (`BookingSummary.jsx`), **debajo del precio** del tren elegido.

## 1. Factores de emisión
| Medio | Factor | Fuente |
|---|---|---|
| Coche de gasolina | 0,183 kg CO₂e por km del vehículo | MITECO, Calculadora de huella de carbono, factores 2007-2025, turismos (M1), opción A.2 «distancia recorrida», año 2025 |
| Coche diésel | 0,159 kg CO₂e por km del vehículo | Ídem |
| Tren | 3,79 g CO₂ por viajero·km | Huella de carbono de Renfe 2024, calculada con el Registro de huella de carbono del MITECO y verificada por AENOR |

- Los factores del coche se han leído directamente de la hoja «10. Factores de emisión» de la calculadora oficial
  del MITECO (`calculadora_hc_tcm30-485617.xlsx`). Vienen del Sistema Español de Inventario de emisiones.
- El MITECO no publica un factor por viajero·km para el tren, por eso se usa la cifra oficial de Renfe.

## 2. Cálculo (`src/lib/carbon.js`)
- **Coche:** factor × km × número de coches. Las emisiones del coche son **por vehículo**: si viajan 4 personas
  van en un solo coche; con 6 o más hacen falta dos (5 plazas por coche).
- **Tren:** 3,79 g × km × número de viajeros (adultos, niños y bebés).
- **Ahorro:** coche − tren, en kg y en %.
- **Distancia:** `routeKm` en `src/lib/mapGeometry.js` suma la distancia real sobre la esfera terrestre
  (`geoDistance` de d3-geo) **parada a parada** del recorrido del tren. `searchTrains` la devuelve como `stationKm`.
  El precio sigue usando esa distancia × 1,15 como antes (la vía no es una línea recta), así que los precios no cambian.

## 3. Interfaz
- `CarbonSaving.jsx`: «Ahorras 75 kg de CO₂ frente al coche», dos barras (coche y tren) y una línea con los km,
  el % de ahorro y, si hay varios viajeros, cuántos coches harían falta.
- Selector **Gasolina / Diésel** para elegir con qué coche comparar (afecta a ida y vuelta).
- Con ida y vuelta, debajo del total: «Ida y vuelta: X kg de CO₂ menos que en coche».
- Nota con enlaces a las fuentes (MITECO y Renfe) al pie del resumen.
- Estilos en `src/styles/carbon.css`, con los colores de estado de la web (claro y oscuro).

### Hojita en la lista de trenes
- Debajo del precio de cada tarjeta («desde 60,45 €») aparece una hojita verde con
  «Ahorras X kg CO₂»: lo que ahorra **un viajero** frente a un coche de **gasolina**.
- Al pasar el ratón se ve el detalle: «Tren: X kg · Coche: Y kg (por viajero, N km)».
  Los lectores de pantalla lo leen también.
- Usa el mismo cálculo que el resumen (`compareWithCar` de `carbon.js`) y la misma hojita (`LeafIcon`),
  así que las cifras coinciden con las del resumen de compra para 1 adulto y gasolina.
- En móvil la hojita baja a su propia línea, alineada a la derecha.
- Código: `TrainCarbon` en `src/components/tickets/TrainList.jsx`, estilos `.train-eco` en `src/styles/carbon.css`.

## Dónde está el código
```
src/lib/mapGeometry.js             distanceKm y routeKm (distancia real entre estaciones)
src/lib/timetable.js               searchTrains devuelve stationKm
src/lib/carbon.js                  Factores oficiales y comparación tren vs. coche
src/lib/carbon.test.js             8 pruebas (npm test)
src/components/tickets/CarbonSaving.jsx    Bloque de CO₂ y selector de combustible
src/components/tickets/BookingSummary.jsx  Lo muestra debajo del precio de cada trayecto
src/styles/carbon.css
```

## Comprobado
- `npm test`: 21 pruebas (13 de compensaciones + 8 nuevas), todas pasan.
- En el navegador: Madrid → Sevilla en AVE (421 km entre estaciones, 1 adulto): coche de gasolina 77 kg, tren 1,6 kg,
  **ahorro de 75 kg (98 %)**; con diésel, 65 kg. En escritorio y en móvil (390 px), sin errores ni scroll lateral.
- Hojita en la lista: Murcia del Carmen → Valladolid-Campo Grande. AVE 05763 (553 km): «Ahorras 99 kg CO₂»
  (tren 2,1 kg · coche 101 kg); AVLO 05817 (623 km, más paradas): «Ahorras 112 kg CO₂». En escritorio y en
  móvil (375 px), sin errores en consola. `npm test`: 21 pruebas, todas pasan; `npm run build` compila.

## Fuentes
- [MITECO · Calculadoras de huella de carbono y factores de emisión](https://www.miteco.gob.es/es/cambio-climatico/temas/mitigacion-politicas-y-medidas/calculadoras.html)
- [Renfe · Descarbonización (huella de carbono unitaria)](https://grupo.renfe.com/es/es/sostenibilidad/descarbonizacion)
