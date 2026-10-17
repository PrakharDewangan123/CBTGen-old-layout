import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const webRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: webRoot,
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/document-processing': {
        target: process.env.CBTGEN_DOCUMENT_PROCESSING_URL || ['http:', '', '127.0.0.1:8000'].join('/'),
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/document-processing/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (process.env.CBTGEN_ENABLE_LOCAL_DEV_AUTH !== '1') return
            const secret = process.env.CBTGEN_LOCAL_DEV_SECRET
            const origin = req.headers.origin
            const host = req.headers.host
            if (!secret || !origin || !host) return
            try {
              const originUrl = new URL(origin)
              const requestUrl = new URL(`http://${host}`)
              const loopbackHosts = ['localhost', '127.0.0.1', '[::1]']
              if (
                originUrl.protocol !== 'http:' ||
                originUrl.host !== requestUrl.host ||
                !loopbackHosts.includes(originUrl.hostname)
              ) return
              proxyReq.setHeader('X-CBTGen-Local-Dev-Secret', secret)
            } catch {
              // Never attach the development credential to malformed origins.
            }
          })
        },
      },
    },
  },
})
