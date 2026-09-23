import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Served from https://<user>.github.io/Brain-expander/
const base = process.env.APP_BASE ?? '/Brain-expander/'

const withPwa = process.env.APP_PWA !== 'off'

export default defineConfig({
  base,
  plugins: [
    react(),
    ...(withPwa ? [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'A Thousand Nights',
        short_name: '1000 Nights',
        description: 'One short story, one poem, one essay. Every night.',
        theme_color: '#0f1117',
        background_color: '#0f1117',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Corpus items are immutable once published: cache them forever on first read.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/corpus/items/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'corpus-items',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/corpus/index.json'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'corpus-index' },
          },
        ],
      },
    })] : []),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as any)
