# Scripts

- `build-wasm.sh` — rebuild the iroh P2P WebAssembly package (see root README).
- `pack-bin.mjs` — pack a `.glb` into the site's custom `.bin` container:
  `node scripts/pack-bin.mjs input.glb [output.bin]`
- `unpack-bin.mjs` — inspect/unpack a `.bin` back into a `.glb` outline:
  `node scripts/unpack-bin.mjs input.bin [output.glb] [--info]`
- `bins2glb.mjs` — rebuild a rigged, animated `.glb` (mesh + bones + clips)
  from a `.bin` set, for editing in Blender:
  `node scripts/bins2glb.mjs kid --dir public/assets/geometries --draco <path>`
  (needs a `draco3d` decoder; see `--draco`)
- `glb2bins.mjs` — the inverse: pack a rigged, animated `.glb` back into the
  `.bin` set (mesh + bones + clips) after editing it, preserving the attribute
  schema of the existing files so the runtime loader is unchanged:
  `node scripts/glb2bins.mjs kid.glb --schema public/assets/geometries --draco <path>`
  (`<name>` is the GLB's base name; `--out` defaults to the GLB's directory,
  `--clips`, `--fps` and `--verify` are optional. Draco may merge exactly
  duplicate vertices on write — geometrically lossless.)

## About the `.bin` format

`src/engine/loaders/bin.ts` reads: 10 ASCII digits holding the JSON header
length, the JSON header (`{ type, attributes: [[name, typeIndex], ...] }`),
then a **Draco-compressed** payload.

**The runtime decoder requires a Draco payload.** `pack-bin.mjs` copies the
GLB's BIN chunk verbatim, so its output is a valid container with a non-Draco
payload until you compress it with a Draco encoder (e.g. `gltfpack` or
`gltf-transform draco`). `unpack-bin.mjs` is intentionally an outline: the
header does not record component counts, so accessors are guessed as VEC3 and
Draco payloads are copied verbatim. Both scripts share `scripts/lib/bin-format.mjs`.
