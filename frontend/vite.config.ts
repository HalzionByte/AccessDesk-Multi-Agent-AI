import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(rootDir, "./src")

// Vite config — https://vitejs.dev/config/
export default defineConfig({
  // Load VITE_* variables from the repository-root .env so the backend and
  // the frontend share the single .env documented in the README.
  envDir: path.resolve(rootDir, ".."),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  server: {
    host: process.env.FIGMA_DEV_SERVER_HOST || "0.0.0.0",
    port: parseInt(process.env.PORT || "5173"),
  },
  preview: {
    host: process.env.FIGMA_DEV_SERVER_HOST || "0.0.0.0",
    port: parseInt(process.env.PORT || "5173"),
  },
})
