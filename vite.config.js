import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
    proxy: {},
    // Nota: los usuarios se obtienen SIEMPRE vía la función serverless /api/usuarios
    // (ver api/usuarios.ts). No hay proxy local hacia servicios internos.
  },
})