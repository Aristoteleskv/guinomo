import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    {
      name: 'allow-iframe-plugin',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.removeHeader('X-Frame-Options');
          res.setHeader('Content-Security-Policy', "frame-ancestors 'self' http://localhost http://localhost:* http://127.0.0.1:*");
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.removeHeader('X-Frame-Options');
          res.setHeader('Content-Security-Policy', "frame-ancestors 'self' http://localhost http://localhost:* http://127.0.0.1:*");
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
    headers: {
      "Access-Control-Allow-Origin": "*",
      // Não use DENY ou SAMEORIGIN aqui
    }
  }
});
