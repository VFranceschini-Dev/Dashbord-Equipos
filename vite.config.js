import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: false,
    hmr: {
      port: 5173,
      protocol: 'ws',
      clientPort: 5173,
    },
  },
  preview: {
    host: "localhost",
    port: 5173,
    strictPort: false,
  },
});
