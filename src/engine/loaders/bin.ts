// The site's .bin geometry format is parsed by the pure (testable) `binFormat`
// module; this file adds the three/Draco decoding on top of it.
//
//   [0..9]      JSON header length (ASCII decimal)
//   [10..10+n]  JSON header, e.g. {"type":0,"attributes":[["position",7],...]}
//   [10+n..]    Draco payload

import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { BufferGeometry } from 'three';
import { assetUrl } from '../../core/assets';
import type { TypedArrayName } from './binFormat';

export {
  TYPED_ARRAYS,
  parseBin,
  encodeBin,
  type BinHeader,
  type BinData,
  type TypedArrayName,
} from './binFormat';

export interface DecodeOptions {
  /** Attribute name → its array index in the header (useUniqueIDs semantics). */
  attributeIDs: Record<string, number>;
  attributeTypes: Record<string, TypedArrayName>;
}

export const decoder = new DRACOLoader().setDecoderPath(assetUrl('assets/libs/draco/')).preload();

export function decodeGeometry(buffer: ArrayBuffer, options: DecodeOptions): Promise<BufferGeometry> {
  const { attributeIDs, attributeTypes } = options;
  return (decoder as any).decodeGeometry(buffer, { attributeIDs, attributeTypes, useUniqueIDs: true });
}
