import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const docker = process.env.VITE_DOCKER === '1'
const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET ||
  (docker ? 'http://api:8000' : 'http://127.0.0.1:8000')

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
  ],
  esbuild: {
    jsx: 'automatic',
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    open: !docker,
    watch: docker ? { usePolling: true } : undefined,
    proxy: {
      // Бэкенд слушает префикс /api/v1 — путь без rewrite: /api → тот же путь на FastAPI.
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
})
