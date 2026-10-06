import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { getSecurityHeaders, SECURITY_HEADERS } from './src/config/security';

export { SECURITY_HEADERS };

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve' && mode === 'development';
  const isTest = Boolean(process.env.VITEST);
  const devHeaders = getSecurityHeaders(isDev);
  const prodHeaders = getSecurityHeaders(false);

  return {
    plugins: [
      react(),
      !isTest &&
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          includeAssets: [
            'favicon.ico',
            'favicon.svg',
            'favicon-16x16.png',
            'favicon-32x32.png',
            'favicon-48x48.png',
            'apple-touch-icon.png',
            'fonts/*.woff2',
          ],
          manifest: {
            id: '/',
            name: 'Tinute — Image Converter & Optimizer',
            short_name: 'Tinute',
            description:
              'Make images smaller in your browser. Free, private image compression with no uploads or sign-up.',
            theme_color: '#0B0B0C',
            background_color: '#0B0B0C',
            display: 'standalone',
            display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
            orientation: 'any',
            scope: '/',
            start_url: '/',
            categories: ['photo', 'productivity', 'utilities'],
            icons: [
              {
                src: '/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: '/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: '/icon-maskable-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
              },
              {
                src: '/icon-maskable-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            runtimeCaching: [
              {
                urlPattern: ({ url }) =>
                  url.pathname.startsWith('/wasm/') && url.pathname.endsWith('.wasm'),
                handler: 'CacheFirst',
                options: {
                  cacheName: 'tinute-wasm-codecs-v1',
                  expiration: {
                    maxEntries: 20,
                    maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                },
              },
            ],
          },
        }),
      {
        name: 'production-response-headers',
        configurePreviewServer(server) {
          server.middlewares.use((request, response, next) => {
            // Vite's static server answers conditional requests before applying preview.headers.
            for (const [name, value] of Object.entries(prodHeaders))
              response.setHeader(name, value);
            if (request.url?.startsWith('/assets/'))
              response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            if (request.url === '/sw.js')
              response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            if (request.url === '/manifest.webmanifest')
              response.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            next();
          });
        },
      },
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      headers: devHeaders,
      port: 5173,
      strictPort: true,
    },
    preview: {
      headers: prodHeaders,
      port: 4173,
      strictPort: true,
    },
    worker: {
      format: 'es',
    },
    build: {
      target: 'es2022',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/zustand') || id.includes('node_modules/comlink')) {
              return 'vendor-core';
            }
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        reporter: ['text', 'json', 'html'],
        exclude: ['node_modules/', 'src/test/'],
      },
    },
  };
});
