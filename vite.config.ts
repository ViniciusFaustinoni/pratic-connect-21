import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.ico', 
        'robots.txt', 
        'pratic-logo.png', 
        'pwa-192x192.png', 
        'pwa-512x512.png',
        'pwa-instalador-192x192.png',
        'pwa-instalador-512x512.png'
      ],
      manifest: {
        name: 'PRATIC Profissional',
        short_name: 'PRATIC Pro',
        description: 'App para instaladores e vistoriadores PRATIC. Gerencie suas tarefas, rotas e instalações.',
        start_url: '/instalador',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1e293b',
        theme_color: '#1e293b',
        categories: ['business', 'productivity'],
        lang: 'pt-BR',
        dir: 'ltr',
        icons: [
          {
            src: '/pwa-instalador-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-instalador-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-instalador-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Minhas Tarefas',
            short_name: 'Tarefas',
            url: '/instalador/tarefas',
            icons: [{ src: '/pwa-instalador-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Ver no Mapa',
            short_name: 'Mapa',
            url: '/instalador/mapa',
            icons: [{ src: '/pwa-instalador-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Meu Perfil',
            short_name: 'Perfil',
            url: '/instalador/perfil',
            icons: [{ src: '/pwa-instalador-192x192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 7 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/instalador/, /^\/app/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1 hora
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/rest\/v1\/(servicos|profiles|rotas)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'profissional-api-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 30 // 30 minutos
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 dias
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
}));
