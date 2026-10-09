#!/usr/bin/env node
// Copies the Vite `dist` build into the PHP social-network host, so the route
// `/rede-social-dev/guinomo` (served by guinomo.php from avatar-3d/) always
// shows the latest bundle.
//
// Target resolution:
//   1. GUINOMO_DEPLOY_DIR (env, created if missing)
//   2. C:\xampp\htdocs\rede-social-dev\avatar-3d  (default, skipped if absent)
//
// Runs automatically via the npm `postbuild` hook; safe on CI/Vercel because it
// no-ops when neither the env var nor the default target exists.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');

const explicitTarget = process.env.GUINOMO_DEPLOY_DIR?.trim();
const defaultTarget = 'C:\\xampp\\htdocs\\rede-social-dev\\avatar-3d';
const target = explicitTarget || defaultTarget;

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  console.error('[deploy] dist/ not found — run `vite build` first.');
  process.exit(1);
}

if (!explicitTarget && !existsSync(target)) {
  console.log(`[deploy] target not found, skipping: ${target}`);
  process.exit(0);
}

// Drop previous hashed bundles so the folder doesn't accumulate stale files.
const assetsDir = join(target, 'assets');
if (existsSync(assetsDir)) {
  const staleBundle = /^(index|iroh|bvh-worker)-.*\.(js|css)$|^guinomo_browser_bg-.*\.wasm$/;
  for (const name of readdirSync(assetsDir)) {
    if (staleBundle.test(name)) rmSync(join(assetsDir, name), { force: true });
  }
}

mkdirSync(target, { recursive: true });
cpSync(distDir, target, { recursive: true, force: true });
console.log(`[deploy] dist/ -> ${target}`);
