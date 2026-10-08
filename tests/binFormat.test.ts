import { describe, expect, it } from 'vitest';
import {
  encodeBin,
  parseBin,
  TYPED_ARRAYS,
  type BinHeader,
} from '../src/engine/loaders/binFormat';

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe('custom .bin container', () => {
  it('parses a hand-built header', () => {
    const header: BinHeader = { type: 0, attributes: [['position', 7], ['index', 4]] };
    const headerJson = new TextEncoder().encode(JSON.stringify(header));
    const lengthText = new TextEncoder().encode(String(headerJson.length).padStart(10, '0'));
    const payload = new Uint8Array([1, 2, 3, 4]);
    const container = new Uint8Array(lengthText.length + headerJson.length + payload.length);
    container.set(lengthText, 0);
    container.set(headerJson, lengthText.length);
    container.set(payload, lengthText.length + headerJson.length);

    const parsed = parseBin(toArrayBuffer(container));
    expect(parsed.header).toEqual(header);
    expect(new Uint8Array(parsed.payload)).toEqual(payload);
  });

  it('round-trips through encodeBin', () => {
    const header: BinHeader = {
      type: 1,
      attributes: [['normal', 7]],
      userData: { source: 'test' },
    };
    const payload = new Uint8Array([9, 8, 7]);

    const parsed = parseBin(encodeBin(header, payload));
    expect(parsed.header).toEqual(header);
    expect(new Uint8Array(parsed.payload)).toEqual(payload);
  });

  it('pads the header length field to 10 ASCII digits', () => {
    const encoded = new Uint8Array(encodeBin({ type: 0, attributes: [] }, new Uint8Array()));
    const lengthText = new TextDecoder().decode(encoded.slice(0, 10));
    expect(lengthText).toMatch(/^\d{10}$/);
    expect(Number(lengthText)).toBe(encoded.length - 10);
  });

  it('uses the runtime typed-array index ordering', () => {
    expect(TYPED_ARRAYS[7]).toBe('Float32Array');
    expect(TYPED_ARRAYS[4]).toBe('Uint16Array');
  });
});
