import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";
import { execSync } from "child_process";

const gitSha = (() => {
  try {
    return execSync("git rev-parse --short=7 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
})();

// Cascata determinística — sem fallback por data (que gerava IDs "fantasma"
// diferentes a cada execução). "dev" é o último recurso e é constante.
const BUILD_ID =
  process.env.BUILD_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.COMMIT_REF ||
  gitSha ||
  "dev";

const VERSION_PAYLOAD = () =>
  JSON.stringify({ buildId: BUILD_ID, builtAt: new Date().toISOString() });

// Plugin que escreve public/version.json no build e serve /version.json
// dinamicamente em dev/preview — garantindo que o valor servido seja
// SEMPRE o mesmo BUILD_ID injetado no bundle via __BUILD_ID__.
const writeVersionJson = () => ({
  name: "write-version-json",
  buildStart() {
    try {
      const dir = path.resolve(__dirname, "public");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "version.json"), VERSION_PAYLOAD());
    } catch (e) {
      console.warn("[write-version-json] falhou:", e);
    }
  },
  configureServer(server: any) {
    server.middlewares.use("/version.json", (_req: any, res: any) => {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.end(VERSION_PAYLOAD());
    });
  },
  configurePreviewServer(server: any) {
    server.middlewares.use("/version.json", (_req: any, res: any) => {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.end(VERSION_PAYLOAD());
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    writeVersionJson(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'favicon.ico', 
        'robots.txt', 
        'logos/logo-full-light.png',
        'logos/logo-full-dark.png',
        'logos/logo-icon-light.png',
        'logos/logo-icon-dark.png',
        'pwa-192x192.png', 
        'pwa-512x512.png',
        'pwa-instalador-192x192.png',
        'pwa-instalador-512x512.png'
      ],
      manifest: false, // Desativado - usando manifests estáticos separados em public/
      workbox: {
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/instalador/, /^\/app/, /^\/cotacao/, /^\/acompanhar/],
        // Importar handler de push notifications
        importScripts: ['/sw-push.js'],
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
