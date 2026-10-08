#!/usr/bin/env node
// Packs a binary glTF (`.glb`) into the site's custom `.bin` geometry container.
//
//   node scripts/pack-bin.mjs input.glb [output.bin]
//
// What this does:
//   1. parses the GLB JSON + BIN chunks,
//   2. builds the `.bin` JSON header (`{ type, attributes, userData }`) from the
//      first mesh primitive, mapping glTF component types to the runtime's
//      TYPED_ARRAYS indices,
//   3. copies the GLB BIN chunk as the payload.
//
// IMPORTANT: the shipping runtime decodes the payload with DRACOLoader
// (src/engine/loaders/bin.ts). A raw GLB BIN chunk is NOT a Draco stream, so
// for production assets run the output through a Draco encoder
// (e.g. `gltfpack -cc` / `gltf-transform draco`) and keep this header. This
// script is a header/container helper, not a Draco compressor.

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { readGlb, encodeBin } from './lib/bin-format.mjs';

const COMPONENT_TO_TYPE_INDEX = {
  5120: 0, // Int8Array
  5121: 1, // Uint8Array
  5122: 3, // Int16Array
  5123: 4, // Uint16Array
  5125: 6, // Uint32Array
  5126: 7, // Float32Array
};

function attributesFor(gltf, primitive) {
  const attributes = [];
  for (const [name, accessorIndex] of Object.entries(primitive.attributes ?? {})) {
    const accessor = gltf.accessors?.[accessorIndex];
    const typeIndex = accessor ? COMPONENT_TO_TYPE_INDEX[accessor.componentType] : undefined;
    attributes.push([name, typeIndex ?? 7]);
  }
  if (typeof primitive.indices === 'number') {
    const accessor = gltf.accessors[primitive.indices];
    const typeIndex = accessor ? COMPONENT_TO_TYPE_INDEX[accessor.componentType] : undefined;
    attributes.push(['index', typeIndex ?? 6]);
  }
  return attributes;
}

const [input, output] = process.argv.slice(2);
if (!input) {
  console.error('Usage: node scripts/pack-bin.mjs <input.glb> [output.bin]');
  process.exit(1);
}

try {
  const inputPath = resolve(input);
  const outputPath = resolve(output ?? inputPath.replace(/\.glb$/i, '') + '.bin');

  const glb = readGlb(readFileSync(inputPath));
  const primitive = glb.json.meshes?.[0]?.primitives?.[0];
  if (!primitive) throw new Error('No mesh primitive found in GLB');

  const header = {
    type: 0,
    attributes: attributesFor(glb.json, primitive),
    userData: {
      source: basename(inputPath),
      generator: 'scripts/pack-bin.mjs',
      note: 'Payload must be Draco-compressed for the runtime decoder.',
    },
  };

  const outputBuffer = encodeBin(header, glb.bin);
  writeFileSync(outputPath, outputBuffer);
  console.log(`Packed ${basename(inputPath)} -> ${outputPath}`);
  console.log(`  attributes: ${header.attributes.map(([name, type]) => `${name}:${type}`).join(', ') || '(none)'}`);
  console.log(`  payload:    ${glb.bin.length} bytes`);
} catch (error) {
  console.error(`pack-bin failed: ${error.message}`);
  process.exit(1);
}
