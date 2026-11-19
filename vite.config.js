import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Las peticiones a /api las atiende el servidor de incidencias (server/index.mjs).
    proxy: { '/api': 'http://localhost:3001' },
  },
});
