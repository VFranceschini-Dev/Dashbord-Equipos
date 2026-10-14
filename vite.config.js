import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
    proxy: {
      // Backend intermedio de Metabase (server/, puerto 4000). En producción
      // el frontend apunta directo a la URL interna del backend vía variable
      // de entorno o rewrite en el hosting.
      "/api/metabase": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
