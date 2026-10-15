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
      // leen a través del proxy interno https://ipa.donnet.com.ar/api que ya está
      // desplegado en la red. Para desarrollo local contra ese proxy no hace falta
      // nada (metabaseProxy.ts usa la URL absoluta). Si alguna vez volvés a correr
      // un backend local, descomentá:
      // "/api/metabase": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
})