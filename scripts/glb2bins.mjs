#!/usr/bin/env node
// Packs a rigged, animated `.glb` back into the site's custom `.bin` set
// (mesh + bones + clips) — the companion of `bins2glb.mjs`, so a character
// edited in Blender can go back into the engine. It preserves the attribute
// schema (names, order, dtypes) of the existing `.bin` set, so the runtime
// loader keeps working unchanged.
//
//   node scripts/glb2bins.mjs <input.glb> [--out <dir>] [--schema <dir>]
//        [--fps 24] [--clips idle=idle,run=run,air=air,bored=bored]
//        [--draco <modulePath>] [--verify]
//
// Schema: `<schema>/<name>.bin` (type 0), `<name>-bones.bin` and
// `<name>-<clip>.bin` (type 1) describe the exact output headers and, once
// decoded, each attribute's component count (the header only stores the dtype).
// `<name>` is the input file's base name, lowercased.
//
// Bind pose is reconstructed from the skin's inverseBindMatrices (robust to a
// Blender rest-pose/normalisation), and animations are resampled at `--fps`
// with the engine's `[frame][bone]` layout.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { readGlb, encodeBin, parseBin } from './lib/bin-format.mjs';

const TYPE_OBJECT = 0;
const TYPE_POINT_CLOUD = 1;

const COMPONENT_ARRAYS = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};
const TYPE_SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const NORMALIZED_MAX = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

const DEFAULT_MESH_ATTRIBUTES = [
  ['skinIndex', 4],
  ['skinWeight', 7],
  ['position', 7],
  ['normal', 7],
  ['colorInfo', 7],
];
const DEFAULT_BONES_ATTRIBUTES = [
  ['position', 7],
  ['quaternion', 7],
  ['scale', 7],
  ['hierarchy', 4],
];
const DEFAULT_CLIP_ATTRIBUTES = [
  ['position', 7],
  ['quaternion', 7],
  ['scale', 7],
];

/** Engine attribute name ← the glTF attribute names that can feed it. */
const ATTRIBUTE_SOURCES = {
  position: ['POSITION', 'position'],
  normal: ['NORMAL', 'normal'],
  skinIndex: ['JOINTS_0', 'skinIndex'],
  skinWeight: ['WEIGHTS_0', 'skinWeight'],
  colorInfo: ['_COLORINFO', 'COLOR_0', 'colorInfo'],
  uv: ['TEXCOORD_0'],
};

function argValue(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && index < args.length - 1 ? args[index + 1] : fallback;
}

function parseClipMap(raw) {
  const map = {};
  for (const part of raw.split(',')) {
    if (!part.trim()) continue;
    const [key, value] = part.split('=');
    map[key.trim()] = (value ?? key).trim();
  }
  return map;
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
  const [encoder, decoder] = await Promise.all([
    draco3d.createEncoderModule({}),
    draco3d.createDecoderModule({}),
  ]);
  return { encoder, decoder };
}

// ---- glTF accessor reading (handles byteStride) --------------------------

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
  const stride = view?.byteStride || itemSize * compSize;
  const data = new DataView(bin.buffer, bin.byteOffset + start, stride * accessor.count);

  const values = new Ctor(accessor.count * itemSize);
  for (let e = 0; e < accessor.count; e++) {
    for (let c = 0; c < itemSize; c++) {
      const off = e * stride + c * compSize;
      switch (accessor.componentType) {
        case 5120:
          values[e * itemSize + c] = data.getInt8(off);
          break;
        case 5121:
          values[e * itemSize + c] = data.getUint8(off);
          break;
        case 5122:
          values[e * itemSize + c] = data.getInt16(off, true);
          break;
        case 5123:
          values[e * itemSize + c] = data.getUint16(off, true);
          break;
        case 5125:
          values[e * itemSize + c] = data.getUint32(off, true);
          break;
        case 5126:
          values[e * itemSize + c] = data.getFloat32(off, true);
          break;
        default:
          throw new Error(`Unsupported componentType ${accessor.componentType}`);
      }
    }
  }
  return {
    array: values,
    itemSize,
    count: accessor.count,
    componentType: accessor.componentType,
    normalized: !!accessor.normalized,
  };
}

// ---- Node / skeleton helpers ---------------------------------------------

function buildParentMap(gltf) {
  const parent = new Array(gltf.nodes.length).fill(-1);
  gltf.nodes.forEach((node, i) => {
    for (const child of node.children ?? []) parent[child] = i;
  });
  return parent;
}

function nodeTRS(node) {
  if (node.matrix) {
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    new Matrix4().fromArray(node.matrix).decompose(position, quaternion, scale);
    return { translation: position.toArray(), quaternion: quaternion.toArray(), scale: scale.toArray() };
  }
  return {
    translation: node.translation ? [...node.translation] : [0, 0, 0],
    quaternion: node.rotation ? [...node.rotation] : [0, 0, 0, 1],
    scale: node.scale ? [...node.scale] : [1, 1, 1],
  };
}

function computeWorlds(gltf, parent, localTRS) {
  const world = new Array(gltf.nodes.length).fill(null);
  const get = (i) => {
    if (world[i]) return world[i];
    const trs = localTRS[i];
    const m = new Matrix4().compose(
      new Vector3(...trs.translation),
      new Quaternion(...trs.quaternion).normalize(),
      new Vector3(...trs.scale),
    );
    if (parent[i] >= 0) m.premultiply(get(parent[i]));
    world[i] = m;
    return m;
  };
  for (let i = 0; i < gltf.nodes.length; i++) get(i);
  return world;
}

// ---- Animation sampling (ported from kaykit2bins.mjs) --------------------

function normalizeQuat(q) {
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  return n > 1e-12 ? q.map((v) => v / n) : [0, 0, 0, 1];
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
  if (sinOmega < 1e-6) result = [0, 1, 2, 3].map((i) => a[i] + (b[i] - a[i]) * t);
  else
    result = [0, 1, 2, 3].map(
      (i) => a[i] * (Math.sin((1 - t) * omega) / sinOmega) + sign * b[i] * (Math.sin(t * omega) / sinOmega),
    );
  return normalizeQuat(result);
}
function sampleChannel(samples, t, interpolation, isQuat) {
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
function buildChannelSamples(anim, gltf, bin, nodeIndex) {
  const byPath = {};
  for (const channel of anim.channels) {
    if (channel.target.node !== nodeIndex) continue;
    const path = channel.target.path;
    const sampler = anim.samplers[channel.sampler];
    const input = readAccessor(gltf, bin, sampler.input);
    const output = readAccessor(gltf, bin, sampler.output);
    const samples = [];
    for (let i = 0; i < input.count; i++) {
      const value = [];
      for (let c = 0; c < output.itemSize; c++) value.push(output.array[i * output.itemSize + c]);
      samples.push({ t: input.array[i], value });
    }
    if (!byPath[path] || byPath[path].samples.length < samples.length) {
      byPath[path] = { interpolation: sampler.interpolation ?? 'LINEAR', samples };
    }
  }
  return byPath;
}
function clipDuration(anim, gltf, bin) {
  let duration = 0;
  for (const channel of anim.channels) {
    const input = readAccessor(gltf, bin, anim.samplers[channel.sampler].input);
    if (input && input.count > 0) duration = Math.max(duration, input.array[input.count - 1]);
  }
  return duration;
}

// ---- Draco schema reading + encoding -------------------------------------

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
function decodeBin(draco, filePath) {
  const { header, payload } = parseBin(readFileSync(resolve(filePath)));
  const ab = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
  const db = new draco.DecoderBuffer();
  db.Init(new Int8Array(ab), ab.byteLength);
  const decoder = new draco.Decoder();
  const gtype = decoder.GetEncodedGeometryType(db);
  let geometry;
  let isMesh = false;
  if (gtype === draco.TRIANGULAR_MESH) {
    geometry = new draco.Mesh();
    const status = decoder.DecodeBufferToMesh(db, geometry);
    if (!status.ok()) throw new Error(`${filePath}: mesh decode failed: ${status.error_msg()}`);
    isMesh = true;
  } else {
    geometry = new draco.PointCloud();
    const status = decoder.DecodeBufferToPointCloud(db, geometry);
    if (!status.ok()) throw new Error(`${filePath}: cloud decode failed: ${status.error_msg()}`);
  }
  const attributes = {};
  for (let id = 0; id < header.attributes.length; id++) {
    const [name, typeIndex] = header.attributes[id];
    const attribute = decoder.GetAttributeByUniqueId(geometry, id);
    if (!attribute || attribute.ptr === 0) throw new Error(`${filePath}: missing attribute "${name}"`);
    const Ctor = ARRAY_CTORS[typeIndex] ?? Float32Array;
    const itemSize = attribute.num_components();
    const numValues = geometry.num_points() * itemSize;
    const byteLength = numValues * Ctor.BYTES_PER_ELEMENT;
    const ptr = draco._malloc(byteLength);
    decoder.GetAttributeDataArrayForAllPoints(
      geometry,
      attribute,
      dracoDataType(draco, Ctor),
      byteLength,
      ptr,
    );
    attributes[name] = { array: new Ctor(draco.HEAPF32.buffer, ptr, numValues).slice(), itemSize };
    draco._free(ptr);
  }
  draco.destroy(geometry);
  draco.destroy(decoder);
  draco.destroy(db);
  return { header, attributes, isMesh };
}

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

function encodeDracoCloud(enc, attrs) {
  const builder = new enc.PointCloudBuilder();
  const cloud = new enc.PointCloud();
  for (const a of attrs) {
    const count = a.data.length / a.components;
    if (a.kind === 'uint16') builder.AddUInt16Attribute(cloud, a.id, count, a.components, a.data);
    else if (a.kind === 'uint32') builder.AddUInt32Attribute(cloud, a.id, count, a.components, a.data);
    else builder.AddFloatAttribute(cloud, a.id, count, a.components, a.data);
  }
  const encoder = new enc.Encoder();
  encoder.SetSpeedOptions(10, 10);
  const out = new enc.DracoInt8Array();
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

function kindFor(typeIndex) {
  switch (typeIndex) {
    case 4:
      return 'uint16';
    case 6:
      return 'uint32';
    default:
      return 'float';
  }
}

// ---- Schema + GLB → data -------------------------------------------------

/** Reads `<name>.bin` (or a fallback) to get the exact output attributes. */
function readMeshSchema(draco, filePath, fallback) {
  try {
    const decoded = decodeBin(draco, filePath);
    return decoded.header.attributes.map(([name, typeIndex]) => ({
      name,
      typeIndex,
      itemSize: decoded.attributes[name]?.itemSize ?? TYPE_SIZES.VEC3,
    }));
  } catch (err) {
    console.warn(`no mesh schema from ${filePath} (${err.message}); using defaults`);
    return fallback.map(([name, typeIndex]) => ({
      name,
      typeIndex,
      itemSize: name === 'skinIndex' || name === 'skinWeight' ? 4 : name === 'colorInfo' ? 2 : 3,
    }));
  }
}

function sourceFor(primitive, engineName) {
  for (const candidate of ATTRIBUTE_SOURCES[engineName] ?? [engineName]) {
    if (primitive.attributes[candidate] !== undefined) return candidate;
  }
  return null;
}

/** Merges every skinned primitive and maps its attributes onto the schema. */
function buildMeshData(gltf, bin, schema) {
  const primitives = [];
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      if (primitive.attributes.JOINTS_0 !== undefined && primitive.attributes.WEIGHTS_0 !== undefined)
        primitives.push(primitive);
    }
  }
  if (primitives.length === 0) throw new Error('no skinned primitive found (needs JOINTS_0 + WEIGHTS_0)');

  const first = primitives[0];
  const sources = {};
  for (const attribute of schema) {
    const source = sourceFor(first, attribute.name);
    if (!source)
      throw new Error(
        `GLB is missing "${attribute.name}" (expected one of ${(ATTRIBUTE_SOURCES[attribute.name] ?? [attribute.name]).join(', ')})`,
      );
    sources[attribute.name] = source;
  }

  let vertexOffset = 0;
  const indices = [];
  const out = {};
  for (const attribute of schema)
    out[attribute.name] = { chunks: [], itemSize: attribute.itemSize, componentType: attribute.typeIndex };

  for (const primitive of primitives) {
    const count = readAccessor(gltf, bin, primitive.attributes[sources.position]).count;
    const primitiveIndices = readAccessor(gltf, bin, primitive.indices);
    for (let i = 0; i < primitiveIndices.count; i++) indices.push(primitiveIndices.array[i] + vertexOffset);

    for (const attribute of schema) {
      const accessor = readAccessor(gltf, bin, primitive.attributes[sources[attribute.name]]);
      out[attribute.name].chunks.push(convertAttribute(accessor, attribute));
    }
    vertexOffset += count;
  }

  const TARGET = { 4: Uint16Array, 6: Uint32Array, 7: Float32Array };
  const result = { indices: Uint32Array.from(indices) };
  for (const attribute of schema) {
    const target = TARGET[attribute.typeIndex] ?? Float32Array;
    const chunkSize = out[attribute.name].chunks[0].length;
    const merged = new target(chunkSize * out[attribute.name].chunks.length);
    let offset = 0;
    for (const chunk of out[attribute.name].chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    result[attribute.name] = merged;
  }
  result.vertices = vertexOffset;
  return result;
}

/** Re-types one accessor onto the schema's dtype + component count. */
function convertAttribute(accessor, attribute) {
  const TARGET = { 4: Uint16Array, 6: Uint32Array, 7: Float32Array };
  const Ctor = TARGET[attribute.typeIndex] ?? Float32Array;
  const result = new Ctor(accessor.count * attribute.itemSize);
  const scale = accessor.normalized ? (NORMALIZED_MAX[accessor.componentType] ?? 1) : 1;
  for (let i = 0; i < accessor.count; i++) {
    for (let c = 0; c < attribute.itemSize; c++) {
      const source = c < accessor.itemSize ? accessor.array[i * accessor.itemSize + c] : 0;
      result[i * attribute.itemSize + c] =
        Ctor === Float32Array ? source / scale : Math.round(source / scale);
    }
  }
  return result;
}

/** Decodes a written `.bin` and returns a one-line summary (for --verify). */
function verifyBin(decoder, filePath) {
  const decoded = decodeBin(decoder, filePath);
  const [firstName] = decoded.header.attributes[0];
  const first = decoded.attributes[firstName];
  const points = first.array.length / first.itemSize;
  const parts = decoded.header.attributes.map(([n]) => `${n}×${decoded.attributes[n].itemSize}`);
  return `${decoded.header.type === TYPE_OBJECT ? 'mesh' : 'cloud'} ${points} pts [${parts.join(', ')}]`;
}

// ---- Main ----------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith('--') && a.toLowerCase().endsWith('.glb'));
  if (!input) {
    console.error(
      'Usage: node scripts/glb2bins.mjs <input.glb> [--out <dir>] [--schema <dir>] [--fps 24] ' +
        '[--clips idle=idle,run=run] [--draco <modulePath>] [--verify]',
    );
    process.exit(1);
  }

  const name = basename(input, extname(input)).toLowerCase();
  const outDir = resolve(argValue(args, '--out', dirname(resolve(input))));
  const schemaDir = resolve(argValue(args, '--schema', dirname(resolve(input))));
  const fps = Number.parseInt(argValue(args, '--fps', '24'), 10);
  const verify = args.includes('--verify');
  const dracoPath = argValue(args, '--draco', null);
  const clipMap = parseClipMap(argValue(args, '--clips', 'idle=idle,run=run,air=air,bored=bored'));

  const glb = readGlb(readFileSync(resolve(input)));
  const { json: gltf, bin } = glb;

  const draco = await loadDraco(dracoPath);
  const schema = readMeshSchema(draco.decoder, join(schemaDir, `${name}.bin`), DEFAULT_MESH_ATTRIBUTES);
  const bonesSchemaHeader = { type: TYPE_POINT_CLOUD, attributes: DEFAULT_BONES_ATTRIBUTES };
  const clipAttributes = (() => {
    try {
      return parseBin(readFileSync(resolve(join(schemaDir, `${name}-${Object.keys(clipMap)[0]}.bin`)))).header
        .attributes;
    } catch {
      return DEFAULT_CLIP_ATTRIBUTES;
    }
  })();

  mkdirSync(outDir, { recursive: true });

  /** Writes a `.bin` and, with --verify, decodes it back as a sanity check. */
  const emit = (file, header, payload) => {
    const path = join(outDir, file);
    writeFileSync(path, encodeBin(header, Buffer.from(payload)));
    if (verify) console.log(`        verify: ${verifyBin(draco.decoder, path)}`);
    return path;
  };

  // ---- Mesh ----
  const meshData = buildMeshData(gltf, bin, schema);
  const meshAttributes = schema.map((a, id) => ({
    id,
    kind: kindFor(a.typeIndex),
    components: a.itemSize,
    data: meshData[a.name],
  }));
  const meshPayload = encodeDracoMesh(draco.encoder, meshAttributes, meshData.indices);
  const meshHeader = { type: TYPE_OBJECT, attributes: schema.map((a) => [a.name, a.typeIndex]) };
  const meshPath = emit(`${name}.bin`, meshHeader, meshPayload);
  console.log(`mesh  : ${meshData.vertices} verts, ${meshData.indices.length / 3} tris -> ${meshPath}`);

  // ---- Skeleton (bind pose from inverseBindMatrices) ----
  const parent = buildParentMap(gltf);
  const staticTRS = gltf.nodes.map((node) => nodeTRS(node));
  const worlds = computeWorlds(gltf, parent, staticTRS);

  const skinIndex = (gltf.nodes.find((n) => n.mesh !== undefined && n.skin !== undefined) ?? {}).skin ?? 0;
  const skin = gltf.skins?.[skinIndex];
  if (!skin) throw new Error('GLB has no skin (needs a skinned mesh + armature)');
  const joints = skin.joints;
  const boneCount = joints.length;
  const jointOfNode = new Map(joints.map((node, b) => [node, b]));
  const parentJoint = (node) => {
    let p = parent[node];
    while (p >= 0 && !jointOfNode.has(p)) p = parent[p];
    return p >= 0 ? jointOfNode.get(p) : -1;
  };
  const meshNode = gltf.nodes.findIndex((n) => n.mesh !== undefined && n.skin !== undefined);
  const meshWorldInverse = (meshNode >= 0 ? worlds[meshNode] : new Matrix4()).clone().invert();

  const ibmAccessor = readAccessor(gltf, bin, skin.inverseBindMatrices);
  const bindWorld = joints.map((_, b) =>
    ibmAccessor ? new Matrix4().fromArray(ibmAccessor.array, b * 16).invert() : worlds[joints[b]].clone(),
  );

  const boneHierarchy = new Uint16Array(boneCount);
  const localBone = (b) => {
    const pj = parentJoint(joints[b]);
    boneHierarchy[b] = pj + 1;
    return (pj >= 0 ? bindWorld[pj].clone().invert() : meshWorldInverse.clone()).multiply(bindWorld[b]);
  };
  const bonesPosition = new Float32Array(boneCount * 3);
  const bonesQuaternion = new Float32Array(boneCount * 4);
  const bonesScale = new Float32Array(boneCount * 3);
  const tmpPos = new Vector3();
  const tmpQuat = new Quaternion();
  const tmpScale = new Vector3();
  for (let b = 0; b < boneCount; b++) {
    localBone(b).decompose(tmpPos, tmpQuat, tmpScale);
    bonesPosition.set(tmpPos.toArray(), b * 3);
    bonesQuaternion.set(tmpQuat.normalize().toArray(), b * 4);
    bonesScale.set(tmpScale.toArray(), b * 3);
  }
  const bonesPayload = encodeDracoCloud(draco.encoder, [
    { id: 0, kind: 'float', components: 3, data: bonesPosition },
    { id: 1, kind: 'float', components: 4, data: bonesQuaternion },
    { id: 2, kind: 'float', components: 3, data: bonesScale },
    { id: 3, kind: 'uint16', components: 1, data: boneHierarchy },
  ]);
  const bonesPath = emit(`${name}-bones.bin`, bonesSchemaHeader, bonesPayload);
  console.log(`bones : ${boneCount} -> ${bonesPath}`);

  // ---- Clips ----
  for (const [key, animationName] of Object.entries(clipMap)) {
    const anim = gltf.animations.find((a) => a.name === animationName);
    if (!anim) {
      console.warn(`clip "${key}": animation "${animationName}" not found — skipped`);
      continue;
    }
    const duration = clipDuration(anim, gltf, bin);
    // The runtime lays frames out over [0, frames/fps] with frames samples
    // (createSkinAnimation: duration = frames/fps, step = duration/(frames-1)),
    // so the inverse is frames = round(duration * fps) — no +1.
    const frames = Math.max(2, Math.round(duration * fps));
    const step = frames / fps / (frames - 1);

    const samplesByNode = new Map();
    for (const channel of anim.channels) {
      if (!samplesByNode.has(channel.target.node))
        samplesByNode.set(channel.target.node, buildChannelSamples(anim, gltf, bin, channel.target.node));
    }

    const positions = new Float32Array(frames * boneCount * 3);
    const quaternions = new Float32Array(frames * boneCount * 4);
    const scales = new Float32Array(frames * boneCount * 3);
    const frameTRS = staticTRS.map((s) => ({ ...s }));
    const jointParent = joints.map((node) => parentJoint(node));

    for (let f = 0; f < frames; f++) {
      const t = f * step;
      for (const [nodeIndex, byPath] of samplesByNode) {
        const trs = frameTRS[nodeIndex];
        if (byPath.translation) {
          const v = sampleChannel(byPath.translation.samples, t, byPath.translation.interpolation, false);
          if (v) trs.translation = v;
        }
        if (byPath.rotation) {
          const v = sampleChannel(byPath.rotation.samples, t, byPath.rotation.interpolation, true);
          if (v) trs.quaternion = v;
        }
        if (byPath.scale) {
          const v = sampleChannel(byPath.scale.samples, t, byPath.scale.interpolation, false);
          if (v) trs.scale = v;
        }
      }
      const frameWorlds = computeWorlds(gltf, parent, frameTRS);
      for (let b = 0; b < boneCount; b++) {
        const pj = jointParent[b];
        const m = (pj >= 0 ? frameWorlds[joints[pj]].clone().invert() : meshWorldInverse.clone()).multiply(
          frameWorlds[joints[b]],
        );
        m.decompose(tmpPos, tmpQuat, tmpScale);
        positions.set(tmpPos.toArray(), (f * boneCount + b) * 3);
        quaternions.set(tmpQuat.normalize().toArray(), (f * boneCount + b) * 4);
        scales.set(tmpScale.toArray(), (f * boneCount + b) * 3);
      }
    }

    const clipPayload = encodeDracoCloud(draco.encoder, [
      { id: 0, kind: 'float', components: 3, data: positions },
      { id: 1, kind: 'float', components: 4, data: quaternions },
      { id: 2, kind: 'float', components: 3, data: scales },
    ]);
    const clipHeader = { type: TYPE_POINT_CLOUD, attributes: clipAttributes, userData: { fps, frames } };
    const clipPath = emit(`${name}-${key}.bin`, clipHeader, clipPayload);
    console.log(`clip  : ${key} (${frames} frames @ ${fps}fps) -> ${clipPath}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(`glb2bins failed: ${err.message}`);
  process.exit(1);
});
