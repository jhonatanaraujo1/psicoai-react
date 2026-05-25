import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: false, // usamos o manifest.json manual em /public
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB (tldraw é pesado)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
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
            if (
              id.includes('/recharts/') ||
              id.includes('/d3-') ||
              id.includes('/d3/') ||
              id.includes('/victory-vendor/') ||
              id.includes('/internmap/') ||
              id.includes('/robust-predicates/')
            ) {
              return 'vendor-recharts'
            }
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
        secure: false,
      },
    },
  },
})
