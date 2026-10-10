// Busca os modelos KayKit (CC0) usados pelo módulo src/core/socialGame.ts.
//
// Os modelos GLB não são guardados no repositório (peso ~2.4 MB cada; o motor
// do Guinomo ainda não os carrega — a geometria do mundo usa .bin e o avatar
// é construído a partir do DNA do perfil). Quando a pipeline de avatares os
// suportar, corre:
//
//   bun scripts/fetch-kaykit.mjs        (ou: node scripts/fetch-kaykit.mjs)
//
// A pasta de saída (vendor/3dweb/kaykit) fica fora do git. Cada ficheiro é
// baixado da tag `main` do repo https://github.com/Imtiaj-Sajin/3dWeb e a
// licença CC0 (KAYKIT_LICENSE.txt) vem junto — é obrigatório mantê-la ao lado
// dos modelos.
//
// Uso:
//   node scripts/fetch-kaykit.mjs [destino]

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const REPO_BASE = 'https://raw.githubusercontent.com/Imtiaj-Sajin/3dWeb/main/public/models';
const MODEL_FILES = [
  'Barbarian.glb',
  'Knight.glb',
  'Mage.glb',
  'Rogue.glb',
  'Rogue_Hooded.glb',
  'barbarian_texture.png',
  'knight_texture.png',
  'rogue_texture.png',
  'KAYKIT_LICENSE.txt',
];
const KB = 1024;

const dest = resolve(process.argv[2] ?? 'vendor/3dweb/kaykit');

function humanSize(bytes) {
  return `${(bytes / KB).toFixed(1)} KB`;
}

async function download(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} para ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(outPath, buf);
  return buf.length;
}

await mkdir(dest, { recursive: true });

let total = 0;
for (const file of MODEL_FILES) {
  const url = `${REPO_BASE}/${file}`;
  const bytes = await download(url, join(dest, file));
  total += bytes;
  console.log(`${file.padEnd(22)} ${humanSize(bytes)} -> ${join(dest, file)}`);
}

console.log(`\nKayKit pack pronto (${humanSize(total)}) em ${dest}`);
console.log('Nota: mantém o KAYKIT_LICENSE.txt junto dos modelos (CC0).');
