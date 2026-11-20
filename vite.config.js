import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Las peticiones a /api las atiende el servidor de datos (server/index.mjs).
const proxy = { '/api': 'http://localhost:3001' };

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  // `npm run share`: versión compilada para enseñarla por un enlace público (túnel de Cloudflare).
  preview: {
    port: 4173,
    proxy,
    allowedHosts: ['.trycloudflare.com'],
  },
});
