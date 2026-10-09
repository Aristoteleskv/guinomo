import { defineConfig } from 'vitest/config';

// Standalone Vitest config: intentionally does NOT extend vite.config.ts, so
// the WASM/top-level-await plugins and the dev-server middleware don't run
// against the pure unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
