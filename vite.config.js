import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const earthJsonPath = path.resolve(__dirname, 'Earth_Simple.json')

/** Упрощённая сцена в корне репозитория → /Earth_Simple.json в dev и в dist */
function earthJsonFromRootPlugin() {
  return {
    name: 'earth-json-from-root',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url === '/Earth_Simple.json') {
          if (fs.existsSync(earthJsonPath)) {
            res.setHeader('Content-Type', 'application/json')
            fs.createReadStream(earthJsonPath).pipe(res)
            return
          }
          res.statusCode = 404
          res.end('Earth_Simple.json not found at project root')
          return
        }
        next()
      })
    },
    writeBundle(options) {
      const outDir = options.dir || path.resolve(__dirname, 'dist')
      const dest = path.join(outDir, 'Earth_Simple.json')
      if (fs.existsSync(earthJsonPath) && fs.existsSync(outDir)) {
        fs.copyFileSync(earthJsonPath, dest)
      }
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), earthJsonFromRootPlugin()],
  server: {
    port: 3000,
    open: true,
  },
})
