import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { getSecurityHeaders, SECURITY_HEADERS } from './src/config/security';

export { SECURITY_HEADERS };

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isDev = command === 'serve' && mode === 'development';
  const devHeaders = getSecurityHeaders(isDev);
  const prodHeaders = getSecurityHeaders(false);

  return {
    plugins: [
      react(),
      {
        name: 'production-response-headers',
        configurePreviewServer(server) {
          server.middlewares.use((request, response, next) => {
            // Vite's static server answers conditional requests before applying preview.headers.
            for (const [name, value] of Object.entries(prodHeaders))
              response.setHeader(name, value);
            if (request.url?.startsWith('/assets/'))
              response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            next();
          });
        },
      },
    ],
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
