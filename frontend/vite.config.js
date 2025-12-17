import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Load settings from root settings.json
const settingsPath = path.resolve(__dirname, '../settings.json')
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: settings.frontend.host,
    port: settings.frontend.port,
  },
  define: {
    // Inject backend API configuration at build time
    '__BACKEND_PORT__': JSON.stringify(settings.backend.port),
    '__BACKEND_HOST__': JSON.stringify(settings.backend.host),
  },
})
