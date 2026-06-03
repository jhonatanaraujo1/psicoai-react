import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// SEC-018: garantir que build de produção não rode sem API configurada
if (process.env.NODE_ENV === 'production' && !process.env.VITE_API_BASE_URL) {
  throw new Error('[vite] VITE_API_BASE_URL não definida — build de produção requer a variável de ambiente')
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: false, // usamos o manifest.json manual em /public
      workbox: {
        // Novo SW toma controle imediatamente (skipWaiting) e reivindica
        // todos os clients abertos (clientsClaim). Combinado com o listener
        // 'controllerchange' em main.jsx, a página recarrega automaticamente
        // após cada novo deploy — sem precisar de Ctrl+Shift+R.
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB (tldraw é pesado)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          // SEC-012: dados clínicos NUNCA cacheados pelo SW — NetworkOnly para toda a API
          {
            urlPattern: /\/api\//i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    // @excalidraw/excalidraw: força pré-bundle via esbuild (CJS/ESM compat com Rolldown/Vite 8)
    // @tldraw/tldraw: pacote pesado, melhor pré-bundled
    include: ['@excalidraw/excalidraw', '@tldraw/tldraw'],
  },
  build: {
    rollupOptions: {
      output: {
        // recharts v3 usa d3-* internamente. d3 sub-packages têm circular deps
        // que causam TDZ no Rollup production bundle quando ficam no mesmo chunk
        // que o código da app. Isolar em chunk próprio resolve o problema.
        manualChunks(id) {
          if (id.includes('/node_modules/')) {
            // React core: isolar garante que react/react-dom são avaliados
            // como chunk próprio ANTES do app code e do workbox-window.
            // Isso elimina a race condition entre SW MessagePort e init do React.
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-is/') ||
              id.includes('/scheduler/')
            ) return 'vendor-react'

            // recharts + todas as sub-deps d3: têm circular deps internas
            // que causam TDZ quando no mesmo chunk que o app code.
            if (
              id.includes('/recharts/') ||
              id.includes('/d3-') ||
              id.includes('/d3/') ||
              id.includes('/internmap/') ||
              id.includes('/robust-predicates/') ||
              id.includes('/victory-vendor/')
            ) return 'vendor-charts'
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8080',
        changeOrigin: true,
        // SEC-013: verificar TLS apenas quando apontando para HTTPS (evita aceitar certs inválidos em staging)
        secure: (process.env.VITE_API_BASE_URL || '').startsWith('https'),
      },
    },
  },
})
