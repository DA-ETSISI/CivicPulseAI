# Fase 3 · Ramas `incidencias` y `rutas`

## Organización
- Cada tema se trabaja en su rama: `incidencias` (tiempo real) y `rutas` (mapa de la red).
- Sin hacer commits, cada rama vive en su propia carpeta con `git worktree` (`DualCore-incidencias`, `DualCore-rutas`).
- Las dos ramas se unieron a `main` y se subieron a GitHub cuando el equipo lo pidió.

## Incidencias en tiempo real
- **Backend** (`server/index.mjs`): la web de Renfe no deja leer sus datos desde el navegador (CORS), así que un servidor
  Node los descarga cada 20 s y los sirve en `/api/incidencias`.
- **Estados:** parado en estación, en camino a la siguiente o en movimiento.
- **Regla de retraso del equipo:** si un tren figura «en movimiento» y su GPS no se desplaza más de 40 m en 3 minutos,
  pasa a «Retraso».
- Se añadieron los **retrasos oficiales**, los **trenes cancelados** y los **avisos** de Renfe.

## Rutas
- El mapa de la red se movió a la sección «Rutas»; la sección «Mapa» queda vacía de momento.
