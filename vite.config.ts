import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  base: './', // CRITICAL: Faz os assets funcionarem em qualquer subpasta do XAMPP
  plugins: [
    wasm(),
    topLevelAwait(),
    {
      name: 'allow-iframe-plugin',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.removeHeader('X-Frame-Options');
          res.setHeader('Content-Security-Policy', "frame-ancestors 'self' http://localhost http://127.0.0.1 http://localhost:* http://127.0.0.1:*");
          next();
        });
      }
    }
  ],
  optimizeDeps: {
    exclude: ['guinomo-browser'],
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    cors: true
  }
});
