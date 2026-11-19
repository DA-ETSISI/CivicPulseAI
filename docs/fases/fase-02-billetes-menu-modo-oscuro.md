# Fase 2 · Menú, modo oscuro, alta velocidad y Billetes

## Qué se hizo
- **Menú:** Mapa, Billetes, Incidencias y Rutas, junto al logotipo, sin formato de pastilla.
- **Billetes debajo del mapa:** al pulsar «Billetes» la página baja con un desplazamiento animado (`src/lib/navigation.js`).
- **Buscador de billetes** con la misma dinámica que Renfe: origen y destino con autocompletado, ida o ida y vuelta,
  fechas, viajeros, lista de trenes del día, tarifas, datos de viajeros y confirmación con localizador.
  Los **horarios son reales** (GTFS de Renfe, 90 días); los **precios son orientativos** (Renfe no los publica en abierto).
- **Modo oscuro** con un botón en la cabecera; se recuerda en el navegador (`src/lib/theme.js`).
- **Mapa solo con alta velocidad de larga distancia** (AVE, AVLO, Euromed), líneas más gruesas, y **Portugal y Francia** visibles.

## Dónde está
- `src/pages/HomePage.jsx` (Mapa + Billetes), `src/pages/TicketsPage.jsx`, `src/components/tickets/*`
- `src/lib/timetable.js`: búsqueda de trenes sobre los horarios y cálculo de precios orientativos.
