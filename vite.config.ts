import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// GitHub Pages liefert die App unter /lernapp/ aus.
export default defineConfig({
  base: '/lernapp/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'beispiel-paket.json'],
      manifest: {
        name: 'Lernapp',
        short_name: 'Lernapp',
        description: 'Prüfungsvorbereitung mit Spaced Repetition',
        lang: 'de',
        theme_color: '#f5f5f7',
        background_color: '#f5f5f7',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
  },
})
