import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load settings from root settings.json (optional for build)
const settingsPath = path.resolve(__dirname, '../settings.json')
let settings = {
  frontend: { host: 'localhost', port: 3000 },
  backend: { host: 'localhost', port: 8000 }
}

try {
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  }
} catch {
  // Use default settings if file cannot be read
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: settings.frontend.host,
    port: settings.frontend.port,
    proxy: {
      // Proxy API requests to backend
      '/api': {
        target: `http://${settings.backend.host}:${settings.backend.port}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
