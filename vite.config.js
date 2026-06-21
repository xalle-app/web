import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const isCapacitor = mode === "capacitor";
  return {
    plugins: [react()],
    // Capacitor loads assets from file://, so paths must be relative
    base: isCapacitor ? "./" : "/",
    build: {
      outDir: "dist",
      // Larger chunk size warning threshold for mobile bundles
      chunkSizeWarningLimit: 1200,
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        "/api": "http://localhost:4000",
        "/uploads": "http://localhost:4000",
        "/ws": { target: "ws://localhost:4000", ws: true },
      },
    },
  };
});
