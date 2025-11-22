import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Proxy backend API during development so calls to /api hit Express on port 5000
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        // Do not rewrite path; backend already expects /api prefix
        // If backend mounted at /api ensure requests stay as-is
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
