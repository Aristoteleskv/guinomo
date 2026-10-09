// The site's custom `.bin` geometry container, in a pure module (no three /
// DOM / WASM dependency) so it can be unit-tested in Node.
//
// Layout:
//   [0..9]      JSON header length (ASCII decimal)
//   [10..10+n]  JSON header, e.g. {"type":0,"attributes":[["position",7],...]}
//   [10+n..]    Draco payload
// Type ids → TypedArray (7=Float32, 4=Uint16...); type 0 = meshes, type 1 = data
// geometries (bones, animation frames, instance patches, curves).

/** TypedArray constructor names, the DRACOLoader worker resolves them via
 *  `self[name]`, and only strings survive postMessage. */
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
] as const;

export interface BinHeader {
  type: number;
  attributes: Array<[string, number]>;
  userData?: Record<string, unknown>;
}

export interface BinData {
  header: BinHeader;
  /** Draco-compressed payload bytes. */
  payload: ArrayBuffer;
}

export type TypedArrayName = (typeof TYPED_ARRAYS)[number];

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();
export const BIN_HEADER_LENGTH_BYTES = 10;

export function parseBin(buffer: ArrayBuffer): BinData {
  const bytes = new Uint8Array(buffer);
  const headerLen = parseInt(textDecoder.decode(bytes.slice(0, BIN_HEADER_LENGTH_BYTES)), 10);
  const header = JSON.parse(
    textDecoder.decode(bytes.slice(BIN_HEADER_LENGTH_BYTES, BIN_HEADER_LENGTH_BYTES + headerLen)),
  ) as BinHeader;
  const payload = bytes.slice(BIN_HEADER_LENGTH_BYTES + headerLen).buffer as ArrayBuffer;
  return { header, payload };
}

/** Inverse of `parseBin`: serializes a header + payload into the container. */
export function encodeBin(header: BinHeader, payload: ArrayBuffer | Uint8Array): ArrayBuffer {
  const headerJson = textEncoder.encode(JSON.stringify(header));
  const lengthText = textEncoder.encode(String(headerJson.length).padStart(BIN_HEADER_LENGTH_BYTES, '0'));
  const payloadBytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const out = new Uint8Array(lengthText.length + headerJson.length + payloadBytes.length);
  out.set(lengthText, 0);
  out.set(headerJson, lengthText.length);
  out.set(payloadBytes, lengthText.length + headerJson.length);
  return out.buffer;
}
