// Shared helpers for the site's custom `.bin` geometry container and glTF `.glb`.
//
// `.bin` layout (see src/engine/loaders/bin.ts):
//   [0..10]      ASCII decimal length of the UTF-8 JSON header
//   [10..10+n]   JSON header: { type, attributes: [[name, typeIndex], ...], userData? }
//   [10+n..]     Draco payload
//
// The `typeIndex` maps into TYPED_ARRAYS below, the same order used by the
// runtime loader (`src/engine/loaders/bin.ts`).

export const TYPED_ARRAYS = [
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
];

export const BIN_HEADER_LENGTH_BYTES = 10;

/** Parses the custom `.bin` container into `{ header, payload }`. */
export function parseBin(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (bytes.length < BIN_HEADER_LENGTH_BYTES) {
    throw new Error(`Invalid .bin: expected at least ${BIN_HEADER_LENGTH_BYTES} bytes, got ${bytes.length}`);
  }

  const headerLength = Number.parseInt(bytes.subarray(0, BIN_HEADER_LENGTH_BYTES).toString('ascii'), 10);
  if (!Number.isInteger(headerLength) || headerLength < 0) {
    throw new Error('Invalid .bin: header length is not a non-negative integer');
  }

  const headerEnd = BIN_HEADER_LENGTH_BYTES + headerLength;
  if (bytes.length < headerEnd) {
    throw new Error(`Invalid .bin: truncated header (need ${headerEnd} bytes, have ${bytes.length})`);
  }

  let header;
  try {
    header = JSON.parse(bytes.subarray(BIN_HEADER_LENGTH_BYTES, headerEnd).toString('utf8'));
  } catch (error) {
    throw new Error(`Invalid .bin: header is not valid JSON (${error.message})`);
  }

  return { header, payload: bytes.subarray(headerEnd) };
}

/** Serializes `{ header, payload }` into the custom `.bin` container. */
export function encodeBin(header, payload = Buffer.alloc(0)) {
  const headerJson = Buffer.from(JSON.stringify(header), 'utf8');
  const lengthText = String(headerJson.length).padStart(BIN_HEADER_LENGTH_BYTES, '0');
  if (lengthText.length !== BIN_HEADER_LENGTH_BYTES) {
    throw new Error('Invalid .bin: JSON header does not fit in 10 length bytes');
  }
  return Buffer.concat([Buffer.from(lengthText, 'ascii'), headerJson, Buffer.from(payload)]);
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"

function pad4(buffer, fill) {
  const remainder = buffer.length % 4;
  if (remainder === 0) return buffer;
  const padded = Buffer.alloc(buffer.length + (4 - remainder), fill);
  buffer.copy(padded);
  return padded;
}

/** Reads a GLB container into `{ json, bin, version }`. */
export function readGlb(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (bytes.length < 12 || bytes.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error('Invalid GLB: bad magic (expected binary glTF)');
  }

  const version = bytes.readUInt32LE(4);
  if (version !== 2) throw new Error(`Unsupported GLB version ${version} (only 2 is supported)`);

  const declaredLength = bytes.readUInt32LE(8);
  const end = Math.min(declaredLength, bytes.length);
  let offset = 12;
  let json = null;
  let bin = Buffer.alloc(0);

  while (offset + 8 <= end) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > end) throw new Error('Invalid GLB: chunk overruns file length');

    if (chunkType === CHUNK_JSON) {
      let jsonText = bytes.subarray(chunkStart, chunkEnd).toString('utf8');
      while (jsonText.endsWith('\u0000')) jsonText = jsonText.slice(0, -1);
      json = JSON.parse(jsonText.trim());
    } else if (chunkType === CHUNK_BIN) {
      bin = Buffer.from(bytes.subarray(chunkStart, chunkEnd));
    }
    offset = chunkEnd;
  }

  if (!json) throw new Error('Invalid GLB: missing JSON chunk');
  return { json, bin, version };
}

/** Writes `{ json, bin }` into a GLB container. */
export function writeGlb(json, bin = Buffer.alloc(0)) {
  const jsonChunk = pad4(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const binChunk = bin.length ? pad4(Buffer.from(bin), 0x00) : Buffer.alloc(0);
  const totalLength = 12 + 8 + jsonChunk.length + (binChunk.length ? 8 + binChunk.length : 0);
  const out = Buffer.alloc(totalLength);

  out.writeUInt32LE(GLB_MAGIC, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLength, 8);

  let offset = 12;
  out.writeUInt32LE(jsonChunk.length, offset);
  out.writeUInt32LE(CHUNK_JSON, offset + 4);
  jsonChunk.copy(out, offset + 8);
  offset += 8 + jsonChunk.length;

  if (binChunk.length) {
    out.writeUInt32LE(binChunk.length, offset);
    out.writeUInt32LE(CHUNK_BIN, offset + 4);
    binChunk.copy(out, offset + 8);
  }

  return out;
}
