import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
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
      "Content-Security-Policy": "frame-ancestors 'self' *",
      "X-Frame-Options": "ALLOWALL",
      "Access-Control-Allow-Origin": "*",
    }
  },
  preview: {
    host: true,
    port: 8081,
    headers: {
      "Content-Security-Policy": "frame-ancestors 'self' *",
      "X-Frame-Options": "ALLOWALL",
      "Access-Control-Allow-Origin": "*",
    }
  },
});
