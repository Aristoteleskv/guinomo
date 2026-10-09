#!/usr/bin/env node
// Unpacks the site's custom `.bin` geometry container into a binary glTF (`.glb`).
//
//   node scripts/unpack-bin.mjs input.bin [output.glb]
//
// This is an OUTLINE converter, not a lossless round-trip of pack-bin:
//   - the `.bin` header only records each attribute's typed-array type, not its
//     component count, so every accessor is emitted as VEC3 (a documented guess),
//   - a Draco-compressed payload is copied verbatim into the GLB BIN chunk, so
//     the resulting glTF is only complete once the matching
//     KHR_draco_mesh_compression extension is added by a Draco-aware tool.
//
// It is useful for inspecting header metadata and for bootstrapping a glTF that
// a Draco-aware pipeline can finish. `--info` prints the header and exits.

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseBin, writeGlb, TYPED_ARRAYS } from './lib/bin-format.mjs';

const COMPONENT_SIZES = {
  Int8Array: 1,
  Uint8Array: 1,
  Uint8ClampedArray: 1,
  Int16Array: 2,
  Uint16Array: 2,
  Int32Array: 4,
  Uint32Array: 4,
  Float32Array: 4,
  Float64Array: 8,
};

const COMPONENT_TYPES = {
  Int8Array: 5120,
  Uint8Array: 5121,
  Uint8ClampedArray: 5121,
  Int16Array: 5122,
  Uint16Array: 5123,
  Int32Array: 5124,
  Uint32Array: 5125,
  Float32Array: 5126,
  Float64Array: 5130,
};

const args = process.argv.slice(2);
const infoOnly = args.includes('--info');
const [input, output] = args.filter((arg) => arg !== '--info');

if (!input) {
  console.error('Usage: node scripts/unpack-bin.mjs <input.bin> [output.glb] [--info]');
  process.exit(1);
}

try {
  const inputPath = resolve(input);
  const { header, payload } = parseBin(readFileSync(inputPath));

  console.log(`Header (${basename(inputPath)}):`);
  console.log(JSON.stringify(header, null, 2));
  console.log(`Payload: ${payload.length} bytes`);

  if (infoOnly) process.exit(0);

  const outputPath = resolve(output ?? inputPath.replace(/\.bin$/i, '') + '.glb');

  const gltf = {
    asset: { version: '2.0', generator: 'scripts/unpack-bin.mjs (outline)' },
    extensionsUsed: [],
    buffers: [{ byteLength: payload.length }],
    bufferViews: payload.length ? [{ buffer: 0, byteOffset: 0, byteLength: payload.length }] : [],
    accessors: [],
    meshes: [],
    extras: {
      guinomo: {
        type: header.type,
        attributes: header.attributes ?? [],
        note: 'Outline only: component counts guessed as VEC3; Draco payload copied verbatim.',
      },
    },
  };

  if (payload.length) {
    const accessors = [];
    const attributes = {};
    for (const [name, typeIndex] of header.attributes ?? []) {
      const typeName = TYPED_ARRAYS[typeIndex] ?? 'Float32Array';
      const componentSize = COMPONENT_SIZES[typeName] ?? 4;
      const count = Math.floor(payload.length / (componentSize * 3));
      if (count <= 0) continue;
      attributes[name] = accessors.length;
      accessors.push({
        bufferView: 0,
        componentType: COMPONENT_TYPES[typeName] ?? 5126,
        count,
        type: 'VEC3',
      });
    }
    gltf.accessors = accessors;
    gltf.meshes = [{ name: basename(inputPath, '.bin'), primitives: [{ attributes, mode: 4 }] }];
  }

  writeFileSync(outputPath, writeGlb(gltf, payload));
  console.log(`Unpacked -> ${outputPath} (outline; see file header for caveats)`);
} catch (error) {
  console.error(`unpack-bin failed: ${error.message}`);
  process.exit(1);
}
