// Production bundle-size budget check (area A / platform guard).
//
// Sums the files matched by each budget in bundle-size.json and fails (exit 1)
// when a budget is exceeded. Wired into .github/workflows/ci.yml after the
// build so bundle regressions are caught in review instead of in production.
//
// Usage:
//   node scripts/check-bundle-size.mjs [distDir]
//
// The default distDir is `dist` relative to the repository root.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = process.cwd();
const distDir = resolve(root, process.argv[2] ?? 'dist');
const configPath = join(root, 'bundle-size.json');

if (!existsSync(distDir)) {
  console.error(`bundle-size: dist directory not found at ${distDir}`);
  console.error('bundle-size: run `bun run build` before this check.');
  process.exit(1);
}

const budgets = JSON.parse(readFileSync(configPath, 'utf8'));

/** Recursively list every file under `dir`, as POSIX-style paths relative to distDir. */
function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(relative(distDir, full).split(sep).join('/'));
  }
  return out;
}

const files = listFiles(distDir);

/** Minimal glob: `*` matches within a path segment, `**` crosses segments. */
function globToRegExp(glob) {
  let pattern = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*') {
      if (glob[i + 1] === '*') {
        pattern += '.*';
        i++;
      } else {
        pattern += '[^/]*';
      }
    } else if ('\\^$+?.()|{}[]'.includes(char)) {
      pattern += `\\${char}`;
    } else {
      pattern += char;
    }
  }
  return new RegExp(`^${pattern}$`);
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

let failed = false;
const rows = [];

for (const budget of budgets) {
  const matchers = budget.include.map(globToRegExp);
  const matched = files.filter((file) => matchers.some((re) => re.test(file)));
  const total = matched.reduce((sum, file) => sum + statSync(join(distDir, file)).size, 0);
  const over = total > budget.maxBytes;
  if (over) failed = true;
  rows.push({ budget, total, count: matched.length, over });
}

const width = Math.max(...rows.map(({ budget }) => budget.label.length), 'budget'.length);
console.log(`\nbundle-size budget (${relative(root, distDir) || 'dist'})\n`);
console.log(`${'budget'.padEnd(width)}  ${'size'.padStart(10)}  ${'limit'.padStart(10)}  files  status`);
console.log(`${'-'.repeat(width)}  ${'-'.repeat(10)}  ${'-'.repeat(10)}  ${'-'.repeat(5)}  ${'-'.repeat(6)}`);
for (const { budget, total, count, over } of rows) {
  console.log(
    `${budget.label.padEnd(width)}  ${formatBytes(total).padStart(10)}  ${formatBytes(budget.maxBytes).padStart(10)}  ${String(count).padStart(5)}  ${over ? 'OVER' : 'ok'}`,
  );
}
console.log('');

if (failed) {
  console.error('bundle-size: one or more budgets were exceeded.');
  process.exit(1);
}
console.log('bundle-size: all budgets within limits.');
