import { describe, expect, it } from 'vitest';
import { lookAngles, LOOK_PITCH, LOOK_YAW } from '../src/core/lookPose';

describe('olhar de lado (pescoço/cabeça)', () => {
  it('é determinístico', () => {
    expect(lookAngles(1234, 0.5, 3)).toEqual(lookAngles(1234, 0.5, 3));
  });

  it('varia ao longo do tempo', () => {
    const a = lookAngles(1000, 0, 0);
    const b = lookAngles(2600, 0, 0);
    expect(a).not.toEqual(b);
  });

  it('o yaw divide-se entre pescoço e cabeça, no mesmo sentido', () => {
    const angles = lookAngles(4321, 0.4, 1.3);
    expect(Math.sign(angles.neckYaw)).toBe(Math.sign(angles.headYaw));
    expect(Math.abs(angles.neckYaw)).toBeGreaterThan(Math.abs(angles.headYaw));
  });

  it('é limitado (nunca exagera)', () => {
    for (let ms = 0; ms < 40_000; ms += 137) {
      for (const speed of [0, 0.5, 1]) {
        const angles = lookAngles(ms, speed, 0.7);
        expect(Number.isFinite(angles.neckYaw)).toBe(true);
        expect(Number.isFinite(angles.headYaw)).toBe(true);
        expect(Math.abs(angles.neckYaw)).toBeLessThanOrEqual(LOOK_YAW);
        expect(Math.abs(angles.headYaw)).toBeLessThanOrEqual(LOOK_YAW);
        expect(Math.abs(angles.pitch)).toBeLessThanOrEqual(LOOK_PITCH);
      }
    }
  });

  it('sementes diferentes dessincronizam os avatares', () => {
    expect(lookAngles(2000, 0, 0)).not.toEqual(lookAngles(2000, 0, 55));
  });
});
