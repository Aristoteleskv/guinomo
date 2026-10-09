import { defineConfig } from '@playwright/test';

// Headless audit of the built app. Uses the system Chrome instead of a
// downloaded Chromium (see `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` in CI/local),
// with SwiftShader so WebGL2 works without a GPU.
export default defineConfig({
  testDir: './tests/e2e',
  // SwiftShader + first-run shader compilation make heavy worlds slow; keep a
  // generous timeout and one retry so a cold start does not fail the audit.
  timeout: 150_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
    headless: true,
    viewport: { width: 800, height: 480 },
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--disable-dev-shm-usage',
      ],
    },
  },
  webServer: {
    // Build first so the audit hook in main.ts is the one being served.
    command: 'npm run build && npm run preview -- --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
