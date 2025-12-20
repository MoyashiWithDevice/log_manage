import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load settings from root settings.json
const settingsPath = path.resolve(__dirname, '../settings.json')
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))

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
