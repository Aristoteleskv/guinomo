// P2P state codec, extracted from iroh.ts so it can be unit-tested without
// pulling in the `guinomo-browser` WebAssembly module.
//
// State encoding (34 bytes; older 32/33-byte frames remain readable):
//   [0]      u8   version (2)
//   [1..13]  p    3 × f32 LE
//   [13..21] r    2 × f32 LE
//   [21]     u8   a (animation: 0 idle, 1 run, 2 bored)
//   [22..26] seed f32 LE
//   [26..30] uid  u32 LE
//   [30]     u8   h (hat visible)
//   [31]     u8   phy (physique index)
//   [32]     u8   age scale (percentage)
//   [33]     u8   gender category (0 unknown, 1 masculine, 2 feminine, 3 other)

export type P2PData = Record<string, number[] | number | string | boolean | null>;

export interface P2PClientData {
  p: number[];
  r: number[];
  a: number;
  seed?: number;
  uid?: number;
  h?: number; // hat visible (1) or hidden (0)
  phy?: number; // physique index
  ageScale?: number; // age-based scale factor
  gender?: string;
  [key: string]: any;
}

export const STATE_VERSION = 2;
export const LEGACY_STATE_BYTES = 32;
export const STATE_BYTES = 34;

export function encodeState(data: P2PData): Uint8Array {
  const out = new Uint8Array(STATE_BYTES);
  const view = new DataView(out.buffer);
  out[0] = STATE_VERSION;
  const p = (data.p as number[]) ?? [0, 0, 0];
  const r = (data.r as number[]) ?? [0, 0];
  for (let i = 0; i < 3; i++) view.setFloat32(1 + i * 4, p[i] ?? 0, true);
  for (let i = 0; i < 2; i++) view.setFloat32(13 + i * 4, r[i] ?? 0, true);
  out[21] = (data.a as number) ?? 0;
  view.setFloat32(22, (data.seed as number) ?? 0, true);
  view.setUint32(26, (data.uid as number) ?? 0, true);
  out[30] = (data.h as number) ?? 1; // Default hat visible
  out[31] = (data.phy as number) ?? 0; // Default physique
  const ageScale = Number(data.ageScale);
  out[32] = Number.isFinite(ageScale)
    ? Math.round(Math.min(1.2, Math.max(0.6, ageScale)) * 100)
    : 100;
  out[33] = data.gender === 'masculino' ? 1
    : data.gender === 'feminino' ? 2
      : data.gender === 'outro' ? 3 : 0;
  return out;
}

export function decodeState(bytes: Uint8Array): P2PClientData {
  if (bytes.length < LEGACY_STATE_BYTES || bytes[0] !== STATE_VERSION) {
    throw new Error(`bad state frame: ${bytes.length} bytes, version ${bytes[0]}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    p: [view.getFloat32(1, true), view.getFloat32(5, true), view.getFloat32(9, true)],
    r: [view.getFloat32(13, true), view.getFloat32(17, true)],
    a: bytes[21],
    seed: view.getFloat32(22, true),
    uid: view.getUint32(26, true),
    h: bytes[30],
    phy: bytes[31],
    ageScale: bytes.length > LEGACY_STATE_BYTES && bytes[32] > 0 ? bytes[32] / 100 : 1,
    gender: bytes.length > 33
      ? ({ 1: 'masculino', 2: 'feminino', 3: 'outro' } as Record<number, string>)[bytes[33]] || 'nao_informado'
      : 'nao_informado',
  };
}
