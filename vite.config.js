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
    proxy: {
      // El backend propio (server/) fue eliminado: los usuarios de SAI_TEST se
      // leen a través de la función serverless api/usuarios.ts (mismo dominio).
      // Para desarrollo local con `vercel dev` esa función sirve /api/usuarios;
      // con `vite` solo, agregá un proxy a `vercel dev` si hace falta.
      // "/api/metabase": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
})