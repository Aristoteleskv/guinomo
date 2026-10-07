import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    {
      name: 'force-allow-iframe',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('X-Frame-Options', 'ALLOWALL');
          res.setHeader('Content-Security-Policy', "frame-ancestors 'self' http://localhost http://127.0.0.1 http://localhost:* http://127.0.0.1:*");
          next();
        });
      }
    }
  ],
  optimizeDeps: {
    exclude: ['guinomo-browser'],
  },
  publicDir: 'public',
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  server: {
    host: true,
    port: 8081,
    strictPort: true,
    cors: true
  },
  preview: {
    host: true,
    port: 8081,
    cors: true
  },
});
