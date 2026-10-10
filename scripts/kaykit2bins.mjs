#!/usr/bin/env node
// Converts a KayKit character GLB (CC0) into the site's custom `.bin` set so
// the engine can load it as a character: mesh + skeleton + animation clips.
//
//   node scripts/kaykit2bins.mjs <input.glb> [--out <dir>] [--fps 24]
//        [--clips idle=Idle,run=Running_A,air=Jump_Idle,bored=Interact]
//        [--draco <modulePath>] [--verify] [--inspect]
//
// What this writes next to the input (or into `--out`), named after the GLB:
//   rogue.bin          character mesh (skinIndex, skinWeight, position,
//                      normal, colorInfo tint zones) + index
//   rogue-bones.bin    skeleton: position/quaternion/scale per bone +
//                      hierarchy (parent index + 1, 0 = root)
//   rogue-<clip>.bin   one per requested clip: per-frame bone local TRS,
//                      header.userData = { fps, frames }
//
// Geometry handling:
//   * Skinned primitives (nodes with a `skin`) are merged into a single mesh;
//     weapons/cape/other non-skinned meshes are dropped (the engine only
//     draws the skinned body; accessories are the engine's own job).
//   * `colorInfo` tint zones are derived from the mesh node name: nodes whose
//     name contains "Head" get the skin zone (y=0.5), everything else gets the
//     shirt zone (y=1.5, r=74). The heads of these models include the hair, so
//     the cartoon hair/mouth masks in fragment.glsl (tuned for kid.bin) will
//     not match the proportions — refining those masks is the "tinta" work, not
//     part of this pipeline proof.
//   * Bones keep the GLB `skin.joints` order (already parent-before-child for
//     these rigs; the script reorders topologically anyway and remaps
//     JOINTS_0). Bone local TRS = inverse(bindWorld(parent)) * bindWorld(joint),
//     so `Rig`/`root`/mesh-node unit transforms cancel out.
//   * Clips are resampled at `--fps`: frames = round(duration * fps) + 1, and
//     per-frame bone locals are computed in the bind-pose parent space, so the
//     engine's keyframe tracks replay the GLB animation exactly. `userData`
//     carries `{ fps, frames }` (the engine derives bone count itself).
//
// The payload of every `.bin` is Draco-compressed (the runtime's
// `DRACOLoader` requires it) and the attribute *unique ids* are the header
// order (the runtime decodes with `useUniqueIDs: true`). Pass `--draco`
// pointing at an installed `draco3d` package (e.g. a temp `npm i draco3d`
// that never touches this repo's package.json) to produce runtime-ready
// payloads; add `--verify` to round-trip them through the package's decoder.
// Without `--draco` the script still writes valid containers with the RAW
// payload and prints a warning — run those through a Draco encoder first,
// exactly like `scripts/pack-bin.mjs` documents.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { readGlb, encodeBin } from './lib/bin-format.mjs';

// glTF component types → JS typed-array constructors.
const COMPONENT_ARRAYS = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};

// glTF `type` strings → number of components per element.
const TYPE_SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

// `type` in the .bin header: 0 = skinned mesh, 1 = point data (bones/clips).
const TYPE_OBJECT = 0;
const TYPE_POINT_CLOUD = 1;

// The engine reads attributes by the order they appear in the `.bin` header
// (DRACOLoader `useUniqueIDs`), so the mesh must keep this exact order.
const MESH_ATTRIBUTES = [
  ['skinIndex', 4], // Uint16Array
  ['skinWeight', 7], // Float32Array
  ['position', 7],
  ['normal', 7],
  ['colorInfo', 7], // vec2 tint zones, see fragment.glsl IS_CHARACTER
];

const BONES_ATTRIBUTES = [
  ['position', 7],
  ['quaternion', 7],
  ['scale', 7],
  ['hierarchy', 4], // Uint16Array
];

const CLIP_ATTRIBUTES = [
  ['position', 7],
  ['quaternion', 7],
  ['scale', 7],
];

const DEFAULT_CLIPS = { idle: 'Idle', run: 'Running_A', air: 'Jump_Idle', bored: 'Interact' };

/** Reads a glTF accessor out of the GLB BIN chunk (handles byteStride). */
function readAccessor(gltf, bin, accessorIndex) {
  if (accessorIndex === undefined || accessorIndex === null) return null;
  const accessor = gltf.accessors[accessorIndex];
  const view = accessor.bufferView !== undefined ? gltf.bufferViews[accessor.bufferView] : null;
  const Ctor = COMPONENT_ARRAYS[accessor.componentType];
  if (!Ctor) throw new Error(`Unsupported componentType ${accessor.componentType}`);
  const itemSize = TYPE_SIZES[accessor.type];
  if (!itemSize) throw new Error(`Unsupported accessor type ${accessor.type}`);

  const compSize = Ctor.BYTES_PER_ELEMENT;
  const start = (view?.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  // Tight packing falls back to itemSize * component size (byteStride is
  // omitted for non-interleaved views in glTF).
  const stride = view?.byteStride || itemSize * compSize;
  const data = new DataView(bin.buffer, bin.byteOffset + start, stride * accessor.count);

  const values = new Ctor(accessor.count * itemSize);
  for (let e = 0; e < accessor.count; e++) {
    for (let c = 0; c < itemSize; c++) {
      const off = e * stride + c * compSize;
      let value;
      switch (accessor.componentType) {
        case 5120:
          value = data.getInt8(off);
          break;
        case 5121:
          value = data.getUint8(off);
          break;
        case 5122:
          value = data.getInt16(off, true);
          break;
        case 5123:
          value = data.getUint16(off, true);
          break;
        case 5125:
          value = data.getUint32(off, true);
          break;
        case 5126:
          value = data.getFloat32(off, true);
          break;
        default:
          throw new Error(`Unsupported componentType ${accessor.componentType}`);
      }
      values[e * itemSize + c] = value;
    }
  }
  return { array: values, itemSize, count: accessor.count };
}

/** Splits a column-major 4x4 matrix into translation / quaternion / scale. */
function decomposeMatrix(m) {
  // three.js Matrix4.decompose(); rows are m[r + c*4].
  const sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);
  const det =
    m[0] * m[5] * m[10] +
    m[1] * m[6] * m[8] +
    m[2] * m[4] * m[9] -
    m[0] * m[6] * m[9] -
    m[1] * m[4] * m[10] -
    m[2] * m[5] * m[8];
  const sign = det < 0 ? -1 : 1;
  const scale = [sx * sign, sy, sz];

  const mt = [
    m[0] / scale[0],
    m[1] / scale[0],
    m[2] / scale[0],
    m[4] / scale[1],
    m[5] / scale[1],
    m[6] / scale[1],
    m[8] / scale[2],
    m[9] / scale[2],
    m[10] / scale[2],
  ];

  const trace = mt[0] + mt[4] + mt[8];
  let q;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1.0) * 2;
    q = [(mt[5] - mt[7]) / s, (mt[6] - mt[2]) / s, (mt[1] - mt[3]) / s, 0.25 * s];
  } else if (mt[0] > mt[4] && mt[0] > mt[8]) {
    const s = Math.sqrt(1.0 + mt[0] - mt[4] - mt[8]) * 2;
    q = [0.25 * s, (mt[1] + mt[3]) / s, (mt[6] + mt[2]) / s, (mt[5] - mt[7]) / s];
  } else if (mt[4] > mt[8]) {
    const s = Math.sqrt(1.0 + mt[4] - mt[0] - mt[8]) * 2;
    q = [(mt[1] + mt[3]) / s, 0.25 * s, (mt[5] + mt[7]) / s, (mt[6] - mt[2]) / s];
  } else {
    const s = Math.sqrt(1.0 + mt[8] - mt[0] - mt[4]) * 2;
    q = [(mt[6] + mt[2]) / s, (mt[5] + mt[7]) / s, 0.25 * s, (mt[1] - mt[3]) / s];
  }
  // q = [x, y, z, w]
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  if (n > 0) q = q.map((v) => v / n);
  return { translation: [m[12], m[13], m[14]], quaternion: q, scale };
}

/** Node local TRS, honoring `matrix` or TRS fields (matrix wins in glTF). */
function nodeTRS(node) {
  if (node.matrix) return decomposeMatrix(node.matrix);
  return {
    translation: node.translation ? [...node.translation] : [0, 0, 0],
    quaternion: node.rotation ? [...node.rotation] : [0, 0, 0, 1],
    scale: node.scale ? [...node.scale] : [1, 1, 1],
  };
}

function mulQuat(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function conjugate(q) {
  return [-q[0], -q[1], -q[2], q[3]];
}

function normalizeQuat(q) {
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  return n > 1e-12 ? q.map((v) => v / n) : [0, 0, 0, 1];
}

function invertTRS(t) {
  const qinv = conjugate(t.quaternion);
  const scale = [1 / t.scale[0], 1 / t.scale[1], 1 / t.scale[2]];
  const rotPos = mulQuat(qinv, t.translation);
  return {
    translation: [-rotPos[0] * scale[0], -rotPos[1] * scale[1], -rotPos[2] * scale[2]],
    quaternion: qinv,
    scale,
  };
}

/** Compose two TRS: a applied, then b (b is the "child" of a). */
function composeTRS(a, b) {
  const t = mulQuat(
    a.quaternion,
    b.translation.map((v, i) => v * a.scale[i]),
  );
  return {
    translation: [a.translation[0] + t[0], a.translation[1] + t[1], a.translation[2] + t[2]],
    quaternion: normalizeQuat(mulQuat(a.quaternion, b.quaternion)),
    scale: [a.scale[0] * b.scale[0], a.scale[1] * b.scale[1], a.scale[2] * b.scale[2]],
  };
}

function lerpVec(a, b, t) {
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
}

function slerpQuat(a, b, t) {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let sign = 1;
  if (dot < 0) {
    dot = -dot;
    sign = -1;
  }
  const omega = Math.acos(Math.min(1, Math.max(-1, dot)));
  const sinOmega = Math.sin(omega);
  let result;
  if (sinOmega < 1e-6) {
    result = [0, 1, 2, 3].map((i) => a[i] + (b[i] - a[i]) * t);
  } else {
    const w1 = Math.sin((1 - t) * omega) / sinOmega;
    const w2 = Math.sin(t * omega) / sinOmega;
    result = [0, 1, 2, 3].map((i) => a[i] * w1 + sign * b[i] * w2);
  }
  return normalizeQuat(result);
}

/**
 * Performs a 1D interpolation of a sampled channel at time `t`.
 * `samples` are { t, value } sorted by t; interpolation ∈ {LINEAR, STEP}.
 */
function sampleChannel(samples, t, interpolation, itemSize, isQuat) {
  if (samples.length === 0) return null;
  if (t <= samples[0].t) return samples[0].value;
  if (t >= samples[samples.length - 1].t) return samples[samples.length - 1].value;
  for (let i = 1; i < samples.length; i++) {
    if (t < samples[i].t) {
      const a = samples[i - 1].value;
      const b = samples[i].value;
      if (interpolation === 'STEP') return a;
      const span = samples[i].t - samples[i - 1].t;
      const f = span > 0 ? (t - samples[i - 1].t) / span : 0;
      return isQuat ? slerpQuat(a, b, f) : lerpVec(a, b, f);
    }
  }
  return samples[samples.length - 1].value;
}

/** Collects { t, value } samples for the channels of ONE animation on `nodeIndex`. */
function buildChannelSamples(anim, gltf, bin, nodeIndex) {
  const byPath = {};
  for (const channel of anim.channels) {
    if (channel.target.node !== nodeIndex) continue;
    const path = channel.target.path;
    const sampler = anim.samplers[channel.sampler];
    const input = readAccessor(gltf, bin, sampler.input);
    const output = readAccessor(gltf, bin, sampler.output);
    const itemSize = output.itemSize;
    const samples = [];
    for (let i = 0; i < input.count; i++) {
      const value = [];
      for (let c = 0; c < itemSize; c++) value.push(output.array[i * itemSize + c]);
      samples.push({ t: input.array[i], value });
    }
    if (!byPath[path] || byPath[path].samples.length < samples.length) {
      byPath[path] = { interpolation: sampler.interpolation ?? 'LINEAR', samples };
    }
  }
  return byPath;
}

function argValue(args, name, fallback) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx === args.length - 1) return fallback;
  return args[idx + 1];
}

/** Resolves `--clips` to { key: glbAnimationName }. */
function parseClipMap(raw) {
  const map = { ...DEFAULT_CLIPS };
  if (!raw) return map;
  for (const part of raw.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key && value) map[key] = value;
  }
  return map;
}

/** parent-of map for every node (root → -1). */
function buildParentMap(gltf) {
  const parent = new Array(gltf.nodes.length).fill(-1);
  gltf.nodes.forEach((node, i) => {
    for (const c of node.children ?? []) parent[c] = i;
  });
  return parent;
}

/** Top-level (depth-first) node order — parents always run before children. */
function nodeDepthOrder(gltf, parent) {
  const order = [];
  const visited = new Array(gltf.nodes.length).fill(false);
  const visit = (n) => {
    if (visited[n]) return;
    if (parent[n] !== -1 && !visited[parent[n]]) visit(parent[n]);
    visited[n] = true;
    order.push(n);
  };
  for (let i = 0; i < gltf.nodes.length; i++) visit(i);
  return order;
}

/** World TRS of every node given local TRS, composed along the node tree. */
function computeWorldTRS(gltf, parent, order, localTRS) {
  const world = new Array(gltf.nodes.length);
  for (const n of order) {
    world[n] = parent[n] === -1 ? localTRS[n] : composeTRS(world[parent[n]], localTRS[n]);
  }
  return world;
}

/**
 * Analyzes the skin: joint nodes, topological bone order (parents first),
 * parent per bone and a remap from the GLB's joint index to the engine order.
 */
function analyzeSkeleton(gltf) {
  const skin = gltf.skins[0];
  if (!skin) throw new Error('No skin found — this is not a skinned character');
  const joints = skin.joints.slice();
  const nodeParents = buildParentMap(gltf);
  const jointIdxOfNode = new Map(joints.map((n, i) => [n, i]));

  // Nearest joint ancestor per joint (node chain may skip non-joint nodes).
  const oldParentIdx = joints.map((n) => {
    let p = nodeParents[n];
    while (p !== -1 && !jointIdxOfNode.has(p)) p = nodeParents[p];
    return p === -1 ? -1 : jointIdxOfNode.get(p);
  });

  // Topological order: parent depth < child depth, so a stable sort by depth
  // puts parents first. The child's own index from the input order breaks ties
  // (already parent-before-child for these rigs).
  const depth = new Array(joints.length).fill(0);
  for (let i = 0; i < joints.length; i++) {
    let j = i;
    while (oldParentIdx[j] !== -1 && depth[j] === 0) {
      const p = oldParentIdx[j];
      depth[j] = depth[p] + 1;
      j = p;
    }
  }
  const order = joints.map((_, i) => i).sort((a, b) => depth[a] - depth[b] || a - b);
  const newIndex = new Array(joints.length);
  order.forEach((oldIdx, idx) => {
    newIndex[oldIdx] = idx;
  });

  return {
    joints,
    oldParentIdx,
    order,
    newIndex,
    parentNew: order.map((oldIdx) => (oldParentIdx[oldIdx] === -1 ? -1 : newIndex[oldParentIdx[oldIdx]])),
  };
}

/** Merge skinned primitives into single arrays (engine bone order applied). */
function buildMeshData(gltf, bin, skel) {
  const positions = [];
  const normals = [];
  const skinIndex = [];
  const skinWeight = [];
  const colorInfo = [];
  const indices = [];
  let vertexOffset = 0;
  let primitives = 0;

  gltf.nodes.forEach((node) => {
    if (node.mesh === undefined || node.skin === undefined) return;
    const isHead = /head/i.test(node.name ?? '');
    for (const prim of gltf.meshes[node.mesh].primitives) {
      if (prim.attributes.JOINTS_0 === undefined) continue; // not skinned
      const pos = readAccessor(gltf, bin, prim.attributes.POSITION);
      const nor = readAccessor(gltf, bin, prim.attributes.NORMAL);
      const join = readAccessor(gltf, bin, prim.attributes.JOINTS_0);
      const weight = readAccessor(gltf, bin, prim.attributes.WEIGHTS_0);
      const idx = readAccessor(gltf, bin, prim.indices);
      if (!pos || !join || !weight) throw new Error(`mesh[${node.mesh}] primitive lacks skin data`);

      const count = pos.count;
      for (let v = 0; v < count; v++) {
        positions.push(pos.array[v * 3], pos.array[v * 3 + 1], pos.array[v * 3 + 2]);
        if (nor) normals.push(nor.array[v * 3], nor.array[v * 3 + 1], nor.array[v * 3 + 2]);
        else normals.push(0, 0, 1);
        // Remap JOINTS_0 (GLB skin.joints order) into the engine bone order.
        skinIndex.push(
          skel.newIndex[join.array[v * 4]] ?? 0,
          skel.newIndex[join.array[v * 4 + 1]] ?? 0,
          skel.newIndex[join.array[v * 4 + 2]] ?? 0,
          skel.newIndex[join.array[v * 4 + 3]] ?? 0,
        );
        skinWeight.push(
          weight.array[v * 4],
          weight.array[v * 4 + 1],
          weight.array[v * 4 + 2],
          weight.array[v * 4 + 3],
        );
        // Tint zones: head → skin (y=0.5), everything else → shirt (y=1.5, r=74).
        colorInfo.push(isHead ? 0 : 74, isHead ? 0.5 : 1.5);
      }
      for (let f = 0; f < idx.count; f++) indices.push(idx.array[f] + vertexOffset);
      vertexOffset += count;
      primitives++;
    }
  });

  if (primitives === 0) throw new Error('No skinned primitives found');
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    skinIndex: new Uint16Array(skinIndex),
    skinWeight: new Float32Array(skinWeight),
    colorInfo: new Float32Array(colorInfo),
    indices: new Uint32Array(indices),
    vertices: vertexOffset,
  };
}

/** Bone bind-pose local TRS + hierarchy (engine createSkin format). */
function buildBonesData(gltf, parent, order, skel) {
  const staticWorld = computeWorldTRS(
    gltf,
    parent,
    order,
    gltf.nodes.map((n) => nodeTRS(n)),
  );
  const bones = skel.joints.length;
  const position = new Float32Array(bones * 3);
  const quaternion = new Float32Array(bones * 4);
  const scale = new Float32Array(bones * 3);
  const hierarchy = new Uint16Array(bones);

  skel.order.forEach((oldIdx, b) => {
    const jointNode = skel.joints[oldIdx];
    const parentOld = skel.oldParentIdx[oldIdx];
    const world = staticWorld[jointNode];
    const local =
      parentOld === -1 ? world : composeTRS(invertTRS(staticWorld[skel.joints[parentOld]]), world);
    position.set(local.translation, b * 3);
    quaternion.set(local.quaternion, b * 4);
    scale.set(local.scale, b * 3);
    hierarchy[b] = skel.parentNew[b] + 1; // 0 = root
  });

  return { position, quaternion, scale, hierarchy, bones };
}

/** Clip duration = latest keyframe time over all channels. */
function clipDuration(anim, gltf, bin) {
  let dur = 0;
  for (const c of anim.channels) {
    const sampler = anim.samplers[c.sampler];
    const input = readAccessor(gltf, bin, sampler.input);
    if (input && input.count > 0) dur = Math.max(dur, input.array[input.count - 1]);
  }
  return dur;
}

/** One clip resampled to `fps`: frames × bones, engine per-frame layout. */
function buildClipData(anim, gltf, bin, parent, order, skel, fps) {
  const duration = clipDuration(anim, gltf, bin);
  if (duration <= 0) throw new Error(`Animation "${anim.name}" has no keyframes`);
  const frames = Math.max(2, Math.round(duration * fps) + 1);
  const step = duration / (frames - 1);
  const bones = skel.joints.length;

  const position = new Float32Array(frames * bones * 3);
  const quaternion = new Float32Array(frames * bones * 4);
  const scale = new Float32Array(frames * bones * 3);

  // Pre-sample channels per animated node (per-frame static nodes stay at bind).
  const samplesByNode = new Map();
  for (const c of anim.channels) {
    if (!samplesByNode.has(c.target.node)) {
      samplesByNode.set(c.target.node, buildChannelSamples(anim, gltf, bin, c.target.node));
    }
  }

  const staticTRS = gltf.nodes.map((n) => nodeTRS(n));
  for (let f = 0; f < frames; f++) {
    const t = f * step;
    const localTRS = staticTRS.map((s) => ({ ...s }));
    for (const [nodeIndex, byPath] of samplesByNode) {
      const trs = localTRS[nodeIndex];
      if (byPath.translation) {
        const v = sampleChannel(byPath.translation.samples, t, byPath.translation.interpolation, 3, false);
        if (v) trs.translation = v;
      }
      if (byPath.rotation) {
        const v = sampleChannel(byPath.rotation.samples, t, byPath.rotation.interpolation, 4, true);
        if (v) trs.quaternion = v;
      }
      if (byPath.scale) {
        const v = sampleChannel(byPath.scale.samples, t, byPath.scale.interpolation, 3, false);
        if (v) trs.scale = v;
      }
    }
    const world = computeWorldTRS(gltf, parent, order, localTRS);

    skel.order.forEach((oldIdx, b) => {
      const jointNode = skel.joints[oldIdx];
      const parentOld = skel.oldParentIdx[oldIdx];
      const w = world[jointNode];
      const local = parentOld === -1 ? w : composeTRS(invertTRS(world[skel.joints[parentOld]]), w);
      const base = f * bones;
      position.set(local.translation, (base + b) * 3);
      quaternion.set(local.quaternion, (base + b) * 4);
      scale.set(local.scale, (base + b) * 3);
    });
  }

  return { position, quaternion, scale, bones, frames, duration };
}

/** Loads the draco3d encoder/decoder modules from a package path. */
async function loadDraco(modulePath) {
  const require = createRequire(import.meta.url);
  let draco3d;
  try {
    draco3d = require(resolve(modulePath));
  } catch (err) {
    throw new Error(`Could not load draco3d from "${modulePath}" (${err.message})`);
  }
  const [encoder, decoder] = await Promise.all([
    draco3d.createEncoderModule({}),
    draco3d.createDecoderModule({}),
  ]);
  return { encoder, decoder };
}

/** Encodes attributes + faces into a Draco triangular-mesh stream. */
function encodeDracoMesh(enc, attrs, indices) {
  const builder = new enc.MeshBuilder();
  const mesh = new enc.Mesh();
  for (const a of attrs) {
    const count = a.data.length / a.components;
    if (a.kind === 'uint16') builder.AddUInt16Attribute(mesh, a.id, count, a.components, a.data);
    else if (a.kind === 'uint32') builder.AddUInt32Attribute(mesh, a.id, count, a.components, a.data);
    else builder.AddFloatAttribute(mesh, a.id, count, a.components, a.data);
  }
  builder.AddFacesToMesh(mesh, indices.length / 3, indices);

  const encoder = new enc.Encoder();
  // Sequential-compatible settings: the default (lossy-fast) path of this
  // draco3d build produces corrupt mesh streams on non-trivial geometry, and
  // type-based quantization is a no-op for MeshBuilder/GENERIC attributes
  // (NORMAL quantization even crashes the encoder). Speed 7+ stays correct.
  encoder.SetSpeedOptions(7, 7);
  const out = new enc.DracoInt8Array();
  const len = encoder.EncodeMeshToDracoBuffer(mesh, out);
  const payload = len > 0 ? readDracoArray(out, len) : null;
  enc.destroy(out);
  enc.destroy(encoder);
  enc.destroy(mesh);
  enc.destroy(builder);
  if (!payload) throw new Error('Draco mesh encoding failed');
  return payload;
}

/** Encodes attributes into a Draco point-cloud stream (bones/clips). */
function encodeDracoCloud(enc, attrs) {
  const builder = new enc.PointCloudBuilder();
  const cloud = new enc.PointCloud();
  let count = 0;
  for (const a of attrs) {
    count = a.data.length / a.components;
    if (a.kind === 'uint16') builder.AddUInt16Attribute(cloud, a.id, count, a.components, a.data);
    else if (a.kind === 'uint32') builder.AddUInt32Attribute(cloud, a.id, count, a.components, a.data);
    else builder.AddFloatAttribute(cloud, a.id, count, a.components, a.data);
  }

  const encoder = new enc.Encoder();
  encoder.SetSpeedOptions(10, 10);
  const out = new enc.DracoInt8Array();
  // Signature: EncodePointCloudToDracoBuffer(cloud, deduplicate, out)
  const len = encoder.EncodePointCloudToDracoBuffer(cloud, false, out);
  const payload = len > 0 ? readDracoArray(out, len) : null;
  enc.destroy(out);
  enc.destroy(encoder);
  enc.destroy(cloud);
  enc.destroy(builder);
  if (!payload) throw new Error('Draco point-cloud encoding failed');
  return payload;
}

function readDracoArray(out, len) {
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = out.GetValue(i) & 0xff;
  return bytes;
}

/** Round-trips a payload through the decoder and reports structure. */
function verifyPayload(dec, payload, header) {
  const ab = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
  const db = new dec.DecoderBuffer();
  db.Init(new Int8Array(ab), ab.byteLength);
  const decoder = new dec.Decoder();
  const type = decoder.GetEncodedGeometryType(db);

  let geom;
  let points;
  if (type === dec.TRIANGULAR_MESH) {
    geom = new dec.Mesh();
    const status = decoder.DecodeBufferToMesh(db, geom);
    if (!status.ok()) throw new Error(`verify: mesh decode failed: ${status.error_msg()}`);
    points = geom.num_points();
  } else if (type === dec.POINT_CLOUD) {
    geom = new dec.PointCloud();
    const status = decoder.DecodeBufferToPointCloud(db, geom);
    if (!status.ok()) throw new Error(`verify: point-cloud decode failed: ${status.error_msg()}`);
    points = geom.num_points();
  } else {
    dec.destroy(db);
    throw new Error(`verify: unknown encoded geometry type ${type}`);
  }

  const check = { type: type === dec.TRIANGULAR_MESH ? 'mesh' : 'cloud', points, attrs: [] };
  header.attributes.forEach(([name], id) => {
    const attr = decoder.GetAttributeByUniqueId(geom, id);
    if (!attr) throw new Error(`verify: missing unique id ${id} (${name})`);
    check.attrs.push({ name, id, components: attr.num_components() });
  });
  dec.destroy(geom);
  dec.destroy(decoder);
  dec.destroy(db);
  return check;
}

async function main() {
  const args = process.argv.slice(2);
  const inspect = args.includes('--inspect');
  const verify = args.includes('--verify');
  const input = args.find((a) => !a.startsWith('--') && a.endsWith('.glb'));
  if (!input) {
    console.error(
      'Usage: node scripts/kaykit2bins.mjs <input.glb> [--out <dir>] [--fps 24] [--clips idle=Idle,run=Running_A] [--draco <modulePath>] [--verify] [--inspect]',
    );
    process.exit(1);
  }

  const outDir = argValue(args, '--out', null);
  const fps = Number.parseInt(argValue(args, '--fps', '24'), 10);
  const clipMapRaw = argValue(args, '--clips', null);
  const dracoPath = argValue(args, '--draco', null);

  const glb = readGlb(readFileSync(resolve(input)));
  const gltf = glb.json;
  const bin = glb.bin;

  // ---- inspect mode: dump the structure so mapping rules can be verified ----
  if (inspect) {
    console.log(`GLB: ${input}`);
    console.log(
      `nodes: ${gltf.nodes.length}, meshes: ${gltf.meshes.length}, skins: ${gltf.skins.length}, animations: ${gltf.animations.length}`,
    );
    gltf.meshes.forEach((mesh, mi) => {
      mesh.primitives.forEach((p, pi) => {
        console.log(
          `mesh[${mi}].primitives[${pi}]: attributes=${Object.keys(p.attributes).join(',')} indices=${p.indices !== undefined} material=${p.material !== undefined ? gltf.materials[p.material].name : 'none'}`,
        );
      });
    });
    gltf.skins.forEach((skin, si) => {
      const jointNames = skin.joints.map((n) => gltf.nodes[n].name).join(',');
      console.log(
        `skin[${si}]: joints=${skin.joints.length} skeleton=${skin.skeleton} inverseBindMatrices=${skin.inverseBindMatrices}`,
      );
      console.log(`skin[${si}].joints: ${jointNames}`);
    });
    gltf.animations.forEach((anim, ai) => {
      const sampler = anim.samplers[anim.channels[0]?.sampler];
      const input = sampler ? readAccessor(gltf, bin, sampler.input) : null;
      const last = input ? input.array[input.count - 1] : 0;
      const fpsGuess = input && input.count > 1 ? input.count / last : 0;
      console.log(
        `animation[${ai}] "${anim.name}": channels=${anim.channels.length} dur=${last.toFixed(3)}s fps~${fpsGuess.toFixed(1)}`,
      );
    });
    gltf.materials.forEach((m, i) => console.log(`material[${i}]: "${m.name}"`));
    // Node hierarchy: name -> children (mesh nodes in brackets) + local TRS.
    gltf.nodes.forEach((node, i) => {
      const meshTag = node.mesh !== undefined ? ` [mesh ${node.mesh}]` : '';
      const t = nodeTRS(node);
      const tf = `t=[${t.translation.map((v) => v.toFixed(3))}] q=[${t.quaternion.map((v) => v.toFixed(3))}] s=[${t.scale.map((v) => v.toFixed(3))}]`;
      console.log(
        `node[${i}] "${node.name}"${meshTag} ${tf} -> ${(node.children ?? []).map((c) => `"${gltf.nodes[c].name}"`).join(', ')}`,
      );
    });
    return;
  }

  const baseName = basename(input, extname(input)).toLowerCase();
  const outputDir = outDir ? resolve(outDir) : dirname(resolve(input));
  mkdirSync(outputDir, { recursive: true });

  const clipMap = parseClipMap(clipMapRaw);
  const parent = buildParentMap(gltf);
  const order = nodeDepthOrder(gltf, parent);
  const skel = analyzeSkeleton(gltf);

  console.log(`Converting ${input} -> ${outputDir} (fps ${fps})`);
  console.log(`bones: ${skel.joints.length}`);

  // ---- mesh ----
  const mesh = buildMeshData(gltf, bin, skel);
  console.log(`mesh: ${mesh.vertices} verts, ${mesh.indices.length / 3} tris`);

  // ---- bones ----
  const bones = buildBonesData(gltf, parent, order, skel);
  console.log(`bones: ${bones.bones}`);

  // ---- clips ----
  for (const key of Object.keys(clipMap)) {
    const glbName = clipMap[key];
    const anim = gltf.animations.find((a) => a.name === glbName);
    if (!anim) {
      console.warn(`clip "${key}": animation "${glbName}" not found — skipped`);
      delete clipMap[key];
    }
  }

  const draco = dracoPath ? await loadDraco(dracoPath) : null;

  const writeAttachment = (header, payload) => encodeBin(header, Buffer.from(payload));

  // Mesh .bin
  {
    const header = { type: TYPE_OBJECT, attributes: MESH_ATTRIBUTES };
    let payload;
    if (draco) {
      payload = encodeDracoMesh(
        draco.encoder,
        [
          { id: 0, kind: 'uint16', components: 4, data: mesh.skinIndex },
          { id: 1, kind: 'float', components: 4, data: mesh.skinWeight },
          { id: 2, kind: 'float', components: 3, data: mesh.positions },
          { id: 3, kind: 'float', components: 3, data: mesh.normals },
          { id: 4, kind: 'float', components: 2, data: mesh.colorInfo },
        ],
        mesh.indices,
      );
    } else {
      payload = Buffer.concat([
        toRaw(mesh.skinIndex),
        toRaw(mesh.skinWeight),
        toRaw(mesh.positions),
        toRaw(mesh.normals),
        toRaw(mesh.colorInfo),
        toRaw(mesh.indices),
      ]);
      console.warn(
        'warning: no --draco given, writing RAW payload (not runtime-ready). Run a Draco encoder on these .bin payloads first.',
      );
    }
    const file = join(outputDir, `${baseName}.bin`);
    writeFileSync(file, writeAttachment(header, payload));
    if (verify && draco) {
      const check = verifyPayload(draco.decoder, payload, header);
      console.log(
        `  verified ${baseName}.bin: ${check.type}, ${check.points} points, ${check.attrs.map((a) => `${a.name}#${a.id}(${a.components})`).join(' ')}`,
      );
    }
  }

  // Bones .bin
  {
    const header = { type: TYPE_POINT_CLOUD, attributes: BONES_ATTRIBUTES };
    let payload;
    if (draco) {
      payload = encodeDracoCloud(draco.encoder, [
        { id: 0, kind: 'float', components: 3, data: bones.position },
        { id: 1, kind: 'float', components: 4, data: bones.quaternion },
        { id: 2, kind: 'float', components: 3, data: bones.scale },
        { id: 3, kind: 'uint16', components: 1, data: bones.hierarchy },
      ]);
    } else {
      payload = Buffer.concat([
        toRaw(bones.position),
        toRaw(bones.quaternion),
        toRaw(bones.scale),
        toRaw(bones.hierarchy),
      ]);
      console.warn('warning: no --draco given, writing RAW payload (not runtime-ready).');
    }
    const file = join(outputDir, `${baseName}-bones.bin`);
    writeFileSync(file, writeAttachment(header, payload));
    if (verify && draco) {
      const check = verifyPayload(draco.decoder, payload, header);
      console.log(
        `  verified ${baseName}-bones.bin: ${check.type}, ${check.points} points, ${check.attrs.map((a) => `${a.name}#${a.id}(${a.components})`).join(' ')}`,
      );
    }
  }

  // Clip .bin (one per requested key)
  for (const key of Object.keys(clipMap)) {
    const glbName = clipMap[key];
    const anim = gltf.animations.find((a) => a.name === glbName);
    const clip = buildClipData(anim, gltf, bin, parent, order, skel, fps);
    const header = {
      type: TYPE_POINT_CLOUD,
      attributes: CLIP_ATTRIBUTES,
      userData: { fps, frames: clip.frames },
    };
    let payload;
    if (draco) {
      payload = encodeDracoCloud(draco.encoder, [
        { id: 0, kind: 'float', components: 3, data: clip.position },
        { id: 1, kind: 'float', components: 4, data: clip.quaternion },
        { id: 2, kind: 'float', components: 3, data: clip.scale },
      ]);
    } else {
      payload = Buffer.concat([toRaw(clip.position), toRaw(clip.quaternion), toRaw(clip.scale)]);
      console.warn('warning: no --draco given, writing RAW payload (not runtime-ready).');
    }
    const file = join(outputDir, `${baseName}-${key}.bin`);
    writeFileSync(file, writeAttachment(header, payload));
    if (verify && draco) {
      const check = verifyPayload(draco.decoder, payload, header);
      console.log(
        `  verified ${baseName}-${key}.bin: ${check.type}, ${check.points} points (${clip.bones} bones × ${clip.frames} frames), ${check.attrs.map((a) => `${a.name}#${a.id}(${a.components})`).join(' ')}`,
      );
    }
  }

  console.log('Done.');
}

function toRaw(typedArray) {
  return Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
}

await main();
