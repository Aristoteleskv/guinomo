#!/usr/bin/env node
// Rebuilds a rigged, animated `.glb` from the site's custom `.bin` set
// (mesh + bones + clips) — the inverse of `kaykit2bins.mjs`, so the character
// can be opened and edited in Blender.
//
//   node scripts/bins2glb.mjs <name> [--dir public/assets/geometries]
//        [--clips idle,run,air,bored] [--out <file.glb>] [--draco <modulePath>]
//
// The `.bin` layout (src/engine/loaders/bin.ts + instancing.ts):
//   mesh  (type 0): Draco TRIANGULAR_MESH; attributes are keyed by header order
//                   (their index is the Draco unique id, `useUniqueIDs`).
//   bones (type 1): Draco POINT_CLOUD: position/quaternion/scale/hierarchy,
//                   where `hierarchy[i] = parent + 1` (0 = root); local TRS.
//   clip  (type 1): Draco POINT_CLOUD: position/quaternion/scale, layout
//                   `[frame][bone]`, `userData { fps, frames }`.
//
// Caveats: the mesh has no UVs (it shades by the per-vertex `colorInfo` zone);
// inverse bind matrices are reconstructed from the bones' bind TRS, matching
// the engine, which binds the skeleton without explicit inverses (createSkin).

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { parseBin, writeGlb } from './lib/bin-format.mjs';

const ARRAY_CTORS = [
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
];

const GLTF_COMPONENT = {
  Int8Array: 5120,
  Uint8Array: 5121,
  Int16Array: 5122,
  Uint16Array: 5123,
  Uint32Array: 5125,
  Float32Array: 5126,
  Float64Array: 5130,
};

const TYPE_FOR_ITEM_SIZE = { 1: 'SCALAR', 2: 'VEC2', 3: 'VEC3', 4: 'VEC4', 16: 'MAT4' };

function argValue(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

async function loadDraco(modulePath) {
  const require = createRequire(import.meta.url);
  let draco3d;
  try {
    draco3d = modulePath ? require(resolve(modulePath)) : require('draco3d');
  } catch (err) {
    throw new Error(
      `could not load draco3d from "${modulePath ?? 'draco3d'}" (${err.message}); ` +
        'install it (e.g. `npm i draco3d` in a temp dir) and pass --draco <path>',
    );
  }
  return draco3d.createDecoderModule({});
}

function dracoDataType(draco, Ctor) {
  switch (Ctor) {
    case Int8Array:
      return draco.DT_INT8;
    case Uint8Array:
      return draco.DT_UINT8;
    case Int16Array:
      return draco.DT_INT16;
    case Uint16Array:
      return draco.DT_UINT16;
    case Int32Array:
      return draco.DT_INT32;
    case Uint32Array:
      return draco.DT_UINT32;
    default:
      return draco.DT_FLOAT32;
  }
}

/** Decodes one `.bin` container into readable attribute arrays (+ index). */
function decodeBin(draco, filePath) {
  const { header, payload } = parseBin(readFileSync(resolve(filePath)));
  const ab = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
  const decoderBuffer = new draco.DecoderBuffer();
  decoderBuffer.Init(new Int8Array(ab), ab.byteLength);
  const decoder = new draco.Decoder();
  const geometryType = decoder.GetEncodedGeometryType(decoderBuffer);

  let geometry;
  let isMesh = false;
  if (geometryType === draco.TRIANGULAR_MESH) {
    geometry = new draco.Mesh();
    const status = decoder.DecodeBufferToMesh(decoderBuffer, geometry);
    if (!status.ok()) throw new Error(`${filePath}: mesh decode failed: ${status.error_msg()}`);
    isMesh = true;
  } else if (geometryType === draco.POINT_CLOUD) {
    geometry = new draco.PointCloud();
    const status = decoder.DecodeBufferToPointCloud(decoderBuffer, geometry);
    if (!status.ok()) throw new Error(`${filePath}: cloud decode failed: ${status.error_msg()}`);
  } else {
    throw new Error(`${filePath}: unknown Draco geometry type ${geometryType}`);
  }

  const numPoints = geometry.num_points();
  const attributes = {};
  for (let id = 0; id < (header.attributes ?? []).length; id++) {
    const [name, typeIndex] = header.attributes[id];
    const attribute = decoder.GetAttributeByUniqueId(geometry, id);
    if (!attribute || attribute.ptr === 0) throw new Error(`${filePath}: missing attribute "${name}" (unique id ${id})`);
    const Ctor = ARRAY_CTORS[typeIndex] ?? Float32Array;
    const itemSize = attribute.num_components();
    const numValues = numPoints * itemSize;
    const byteLength = numValues * Ctor.BYTES_PER_ELEMENT;
    const ptr = draco._malloc(byteLength);
    decoder.GetAttributeDataArrayForAllPoints(geometry, attribute, dracoDataType(draco, Ctor), byteLength, ptr);
    const array = new Ctor(draco.HEAPF32.buffer, ptr, numValues).slice();
    draco._free(ptr);
    attributes[name] = { array, itemSize };
  }

  let index = null;
  if (isMesh) {
    const numIndices = geometry.num_faces() * 3;
    const byteLength = numIndices * 4;
    const ptr = draco._malloc(byteLength);
    decoder.GetTrianglesUInt32Array(geometry, byteLength, ptr);
    index = new Uint32Array(draco.HEAPF32.buffer, ptr, numIndices).slice();
    draco._free(ptr);
  }

  draco.destroy(geometry);
  draco.destroy(decoder);
  draco.destroy(decoderBuffer);
  return { header, attributes, index, isMesh, numPoints };
}

function bounds(array, itemSize) {
  const min = new Array(itemSize).fill(Infinity);
  const max = new Array(itemSize).fill(-Infinity);
  for (let i = 0; i < array.length; i += itemSize) {
    for (let c = 0; c < itemSize; c++) {
      const v = array[i + c];
      if (v < min[c]) min[c] = v;
      if (v > max[c]) max[c] = v;
    }
  }
  return { min, max };
}

/** Small append-only glTF builder (one bufferView per accessor). */
class GlbBuilder {
  constructor() {
    this.gltf = {
      asset: { version: '2.0', generator: 'scripts/bins2glb.mjs' },
      scene: 0,
      scenes: [{ nodes: [] }],
      nodes: [],
      meshes: [],
      materials: [],
      skins: [],
      animations: [],
      accessors: [],
      bufferViews: [],
      buffers: [],
    };
    this.chunks = [];
    this.length = 0;
  }

  _align() {
    const pad = (4 - (this.length % 4)) % 4;
    if (pad) {
      this.chunks.push(Buffer.alloc(pad));
      this.length += pad;
    }
  }

  addAccessor(array, itemSize, { type, withBounds = false } = {}) {
    this._align();
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const view = this.gltf.bufferViews.length;
    this.gltf.bufferViews.push({ buffer: 0, byteOffset: this.length, byteLength: bytes.length });
    this.chunks.push(bytes);
    this.length += bytes.length;

    const accessor = {
      bufferView: view,
      componentType: GLTF_COMPONENT[array.constructor.name] ?? 5126,
      count: array.length / itemSize,
      type: type ?? TYPE_FOR_ITEM_SIZE[itemSize],
    };
    if (withBounds) Object.assign(accessor, bounds(array, itemSize));
    const index = this.gltf.accessors.length;
    this.gltf.accessors.push(accessor);
    return index;
  }

  finish(bin = Buffer.concat(this.chunks)) {
    this.gltf.buffers.push({ byteLength: bin.length });
    return writeGlb(this.gltf, bin);
  }
}

function buildSkeleton(bones) {
  const position = bones.attributes.position.array;
  const quaternion = bones.attributes.quaternion.array;
  const scale = bones.attributes.scale.array;
  const hierarchy = bones.attributes.hierarchy.array;
  const count = position.length / 3;

  const parent = new Array(count);
  for (let i = 0; i < count; i++) parent[i] = hierarchy[i] - 1;

  const local = new Array(count);
  for (let i = 0; i < count; i++) {
    local[i] = new Matrix4().compose(
      new Vector3(position[i * 3], position[i * 3 + 1], position[i * 3 + 2]),
      new Quaternion(quaternion[i * 4], quaternion[i * 4 + 1], quaternion[i * 4 + 2], quaternion[i * 4 + 3]).normalize(),
      new Vector3(scale[i * 3], scale[i * 3 + 1], scale[i * 3 + 2]),
    );
  }

  const world = new Array(count).fill(null);
  const worldOf = (i) => {
    if (world[i]) return world[i];
    const m = local[i].clone();
    if (parent[i] >= 0) m.premultiply(worldOf(parent[i]));
    world[i] = m;
    return m;
  };

  const inverseBind = new Float32Array(count * 16);
  for (let i = 0; i < count; i++) inverseBind.set(worldOf(i).clone().invert().elements, i * 16);

  const roots = [];
  for (let i = 0; i < count; i++) if (parent[i] < 0) roots.push(i);
  return { count, parent, roots, inverseBind, position, quaternion, scale };
}

function buildGlb({ name, mesh, bones, clips }) {
  const builder = new GlbBuilder();
  const { gltf } = builder;

  // ---- Mesh ----
  const position = mesh.attributes.position;
  const normal = mesh.attributes.normal;
  const primitiveAttributes = {
    POSITION: builder.addAccessor(position.array, position.itemSize, { withBounds: true }),
    NORMAL: builder.addAccessor(normal.array, normal.itemSize),
  };
  const skinIndex = mesh.attributes.skinIndex;
  if (skinIndex) {
    const joints = skinIndex.array instanceof Uint16Array ? skinIndex.array : Uint16Array.from(skinIndex.array);
    primitiveAttributes.JOINTS_0 = builder.addAccessor(joints, skinIndex.itemSize, { type: 'VEC4' });
  }
  const skinWeight = mesh.attributes.skinWeight;
  if (skinWeight) primitiveAttributes.WEIGHTS_0 = builder.addAccessor(skinWeight.array, skinWeight.itemSize, { type: 'VEC4' });

  const colorInfo = mesh.attributes.colorInfo;
  if (colorInfo && colorInfo.itemSize >= 3) {
    primitiveAttributes.COLOR_0 = builder.addAccessor(colorInfo.array, colorInfo.itemSize, {
      type: colorInfo.itemSize === 4 ? 'VEC4' : 'VEC3',
    });
  } else if (colorInfo) {
    // Zone data (VEC2) is not a valid COLOR_0; keep it as a custom attribute.
    primitiveAttributes._COLORINFO = builder.addAccessor(colorInfo.array, colorInfo.itemSize, { type: 'VEC2' });
  }

  const primitive = { attributes: primitiveAttributes, material: 0, mode: 4 };
  if (mesh.index) primitive.indices = builder.addAccessor(mesh.index, 1, { type: 'SCALAR' });

  gltf.materials.push({
    name,
    pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.85 },
    doubleSided: true,
  });
  gltf.meshes.push({ name, primitives: [primitive] });

  // ---- Skeleton ----
  const skeleton = buildSkeleton(bones);
  for (let i = 0; i < skeleton.count; i++) {
    gltf.nodes.push({
      name: `bone_${i}`,
      translation: [skeleton.position[i * 3], skeleton.position[i * 3 + 1], skeleton.position[i * 3 + 2]],
      rotation: [
        skeleton.quaternion[i * 4],
        skeleton.quaternion[i * 4 + 1],
        skeleton.quaternion[i * 4 + 2],
        skeleton.quaternion[i * 4 + 3],
      ],
      scale: [skeleton.scale[i * 3], skeleton.scale[i * 3 + 1], skeleton.scale[i * 3 + 2]],
    });
  }
  for (let i = 0; i < skeleton.count; i++) {
    const p = skeleton.parent[i];
    if (p >= 0) (gltf.nodes[p].children ??= []).push(i);
  }
  const meshNodeIndex = gltf.nodes.length;
  gltf.nodes.push({ name, mesh: 0, skin: 0 });
  gltf.scenes[0].nodes = [...skeleton.roots, meshNodeIndex];

  const inverseBindAccessor = builder.addAccessor(skeleton.inverseBind, 16, { type: 'MAT4' });
  gltf.skins.push({
    joints: Array.from({ length: skeleton.count }, (_, i) => i),
    inverseBindMatrices: inverseBindAccessor,
    ...(skeleton.roots.length === 1 ? { skeleton: skeleton.roots[0] } : {}),
  });

  // ---- Animations ----
  for (const { key, data } of clips) {
    const { frames, fps } = data.header.userData ?? {};
    if (!frames || !fps) continue;
    const positions = data.attributes.position.array;
    const quaternions = data.attributes.quaternion.array;
    const scales = data.attributes.scale.array;
    const boneCount = positions.length / (frames * 3);

    const duration = frames / fps;
    const step = duration / (frames - 1);
    const times = Float32Array.from({ length: frames }, (_, f) => f * step);
    const input = builder.addAccessor(times, 1, { type: 'SCALAR', withBounds: true });

    const animation = { name: key, samplers: [], channels: [] };
    for (let b = 0; b < boneCount; b++) {
      const translation = new Float32Array(frames * 3);
      const rotation = new Float32Array(frames * 4);
      const scale = new Float32Array(frames * 3);
      for (let f = 0; f < frames; f++) {
        const base = f * boneCount + b;
        for (let c = 0; c < 3; c++) {
          translation[f * 3 + c] = positions[base * 3 + c];
          scale[f * 3 + c] = scales[base * 3 + c];
        }
        const q = new Quaternion(quaternions[base * 4], quaternions[base * 4 + 1], quaternions[base * 4 + 2], quaternions[base * 4 + 3]).normalize();
        rotation[f * 4] = q.x;
        rotation[f * 4 + 1] = q.y;
        rotation[f * 4 + 2] = q.z;
        rotation[f * 4 + 3] = q.w;
      }
      const paths = [
        ['translation', translation],
        ['rotation', rotation],
        ['scale', scale],
      ];
      for (const [path, output] of paths) {
        const sampler = animation.samplers.length;
        animation.samplers.push({ input, output: builder.addAccessor(output, output.length / frames), interpolation: 'LINEAR' });
        animation.channels.push({ sampler, target: { node: b, path } });
      }
    }
    gltf.animations.push(animation);
  }

  return { buffer: builder.finish(), stats: { bones: skeleton.count, vertices: mesh.numPoints, triangles: mesh.index ? mesh.index.length / 3 : 0 } };
}

async function main() {
  const args = process.argv.slice(2);
  const name = args.find((a) => !a.startsWith('--')) ?? 'kid';
  const dir = argValue(args, '--dir', 'public/assets/geometries');
  const clips = argValue(args, '--clips', 'idle,run,air,bored')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const out = argValue(args, '--out', `${name}.glb`);
  const dracoPath = argValue(args, '--draco', null);

  const draco = await loadDraco(dracoPath);
  const mesh = decodeBin(draco, `${dir}/${name}.bin`);
  const bones = decodeBin(draco, `${dir}/${name}-bones.bin`);
  const clipData = clips.map((key) => ({ key, data: decodeBin(draco, `${dir}/${name}-${key}.bin`) }));

  console.log(`mesh   : ${mesh.numPoints} vertices, ${mesh.index ? mesh.index.length / 3 : 0} triangles`);
  for (const [attr, { itemSize, array }] of Object.entries(mesh.attributes)) {
    console.log(`  ${attr.padEnd(11)} ${array.constructor.name}  x${itemSize}  (${array.length})`);
  }
  console.log(`bones  : ${bones.attributes.position.array.length / 3}`);
  for (const { key, data } of clipData) {
    console.log(`clip ${key.padEnd(5)}: ${data.header.userData?.frames} frames @ ${data.header.userData?.fps}fps`);
  }

  const { buffer, stats } = buildGlb({ name, mesh, bones, clips: clipData });
  writeFileSync(resolve(out), buffer);
  console.log(`wrote  : ${resolve(out)} (${(buffer.length / 1024).toFixed(1)} KB) — ${stats.vertices} verts, ${stats.triangles} tris, ${stats.bones} bones`);
}

main().catch((err) => {
  console.error(`bins2glb failed: ${err.message}`);
  process.exit(1);
});
