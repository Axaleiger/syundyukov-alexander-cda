import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const docker = process.env.VITE_DOCKER === '1'

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    open: !docker,
    watch: docker ? { usePolling: true } : undefined,
    proxy: {
      '/api': {
        target: 'http://api:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
