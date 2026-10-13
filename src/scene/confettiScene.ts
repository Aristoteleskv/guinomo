// Celebration confetti (3D): a pooled points system that fires short bursts on
// the project's big moments — pair linked, Grand Secret unlocked, collective
// seal minted, polaroid placed. Shards come from the deterministic core
// (core/confetti.ts); the scene animates them with gravity and wobble. Additive
// points only — no shader changes.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  PointsMaterial,
} from 'three';
import { events } from '../core/events';
import {
  confettiBurst,
  CONFETTI_GRAVITY,
  CONFETTI_SPREAD,
  pieceColor,
  type ConfettiPiece,
  type ConfettiTheme,
} from '../core/confetti';
import { clock } from '../engine/clock';
import { SceneModule } from './SceneModule';

const CAPACITY = 1600;

interface ActiveBurst {
  x: number;
  y: number;
  z: number;
  seed: number;
  theme: ConfettiTheme;
  pieces: ConfettiPiece[];
  birth: number; // seconds (clock.time) when the burst was born
  lifetime: number;
}

export class ConfettiScene extends SceneModule {
  private geometry!: BufferGeometry;
  private material!: PointsMaterial;
  private points!: Points;
  private palette = new Map<string, Color>();
  private active: ActiveBurst[] = [];

  protected init() {
    const positions = new Float32Array(CAPACITY * 3).fill(-9999);
    const colors = new Float32Array(CAPACITY * 3);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new BufferAttribute(colors, 3));

    this.material = new PointsMaterial({
      size: 0.18,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(this.geometry, this.material);
    this.scene.add(this.points);

    events.on('webgl_pair_linked', () => this.fire('neutral', 90));
    events.on('webgl_grand_secret_unlocked', () => this.fire('gold', 240));
    events.on('world_call_claimed', () => this.fire('gold', 180));
    events.on('webgl_polaroid_placed', () => this.fire('violet', 70));

    this.scene.beforeRenderCbs.push(this.update);
    this.ready.resolve();
  }

  private fire(theme: ConfettiTheme, count: number): void {
    const local = this.scene.characters?.mesh?._localObject;
    const origin = local?.position;
    const x = origin ? origin.x : 0;
    const y = origin ? origin.y + 1.2 : 1.2;
    const z = origin ? origin.z : 0;

    // A fresh seed every ~250 ms so repeated moments still burst differently.
    const seed = Math.floor(Date.now() / 250);
    const pieces = confettiBurst(seed, theme, count);
    const lifetime = Math.max(0.01, ...pieces.map((piece) => piece.ttl));
    this.active.push({ x, y, z, seed, theme, pieces, birth: clock.time, lifetime });
    if (this.active.length > 12) this.active.shift();
  }

  private update = () => {
    const now = clock.time;
    this.active = this.active.filter((burst) => now - burst.birth < burst.lifetime);

    const position = this.geometry.attributes.position.array as Float32Array;
    const colors = this.geometry.attributes.color.array as Float32Array;
    position.fill(-9999);
    colors.fill(0);

    let slot = 0;
    for (const burst of this.active) {
      const age = now - burst.birth;
      const spread = CONFETTI_SPREAD + age * 0.22;
      let shardIndex = 0;
      for (const piece of burst.pieces) {
        if (age >= piece.ttl || slot >= CAPACITY) continue;
        const rise = piece.dy + piece.vy * age - 0.5 * CONFETTI_GRAVITY * age * age;
        if (rise < -1) continue;
        const i = slot * 3;
        position[i] = burst.x + piece.dx * spread + Math.sin(piece.phase + age * 2.6) * 0.4;
        position[i + 1] = burst.y + Math.max(0, rise);
        position[i + 2] = burst.z + piece.dz * spread + Math.cos(piece.phase + age * 2.2) * 0.4;
        const color = this.colorOf(pieceColor(burst.seed, shardIndex, burst.theme));
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
        shardIndex++;
        slot++;
      }
    }

    this.material.size = 0.16 + 0.05 * Math.sin(now * 9);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  };

  private colorOf(hex: string): Color {
    const cached = this.palette.get(hex);
    if (cached) return cached;
    const color = new Color(hex);
    this.palette.set(hex, color);
    return color;
  }
}