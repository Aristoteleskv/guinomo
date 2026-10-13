// Rain — the "calm drizzle vs heavy storm" the user asked for. The weather
// *state* is shared and deterministic (core/weather.ts: world + UTC clock, so
// everyone in a world sees the same forecast) and this module renders it as a
// column of falling streaks that follows the player. No networking, no new
// assets: one LineSegments pool advected each frame. Preview on demand with
// `?weather=drizzle|rain|storm|clear`.

import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, Vector3 } from 'three';
import { client } from '../core/client';
import { getWorldId } from '../core/worlds';
import { clock } from '../engine/clock';
import {
  forcedWeather,
  rainDropCount,
  rainDropLength,
  rainFallSpeed,
  rainOpacity,
  weatherFor,
  type WeatherState,
} from '../core/weather';
import { SceneModule } from './SceneModule';
import type { EnvironmentScene } from './environmentScene';

/** Half-width of the rain column around the player (metres). */
const HALF_SPAN = 26;
const TOP = 22;
const BOTTOM = -2;
/** How often the deterministic forecast is re-evaluated (ms). */
const REFRESH_MS = 20_000;

/** A tiny deterministic PRNG so the drop layout is stable and cheap. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RainScene extends SceneModule {
  private drops = 0;
  private positions!: Float32Array;
  /** Per-drop x/z plus current y, in the column's local space. */
  private xs!: Float32Array;
  private ys!: Float32Array;
  private zs!: Float32Array;
  private mesh!: LineSegments;
  private material!: LineBasicMaterial;
  private rand = mulberry32(0x9e3779b9);
  private state: WeatherState = { kind: 'clear', intensity: 0, wind: 0, wetness: 0 };
  private lastRefresh = -Infinity;
  private readonly anchor = new Vector3();
  private readonly world: string;
  /** Set by the interiors module while the player is indoors (no rain in a room). */
  suspended = false;

  constructor(scene: EnvironmentScene) {
    super(scene);
    this.world = getWorldId(new URLSearchParams(window.location.search).get('world'));
  }

  protected init(): void {
    // Mobile GPUs (and the memory budget) get a thinner column.
    const max = client.device === 'mobile' ? 700 : 1500;
    this.drops = max;
    this.xs = new Float32Array(max);
    this.ys = new Float32Array(max);
    this.zs = new Float32Array(max);
    this.positions = new Float32Array(max * 2 * 3);

    for (let i = 0; i < max; i++) {
      this.xs[i] = (this.rand() * 2 - 1) * HALF_SPAN;
      this.ys[i] = BOTTOM + this.rand() * (TOP - BOTTOM);
      this.zs[i] = (this.rand() * 2 - 1) * HALF_SPAN;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    geometry.setDrawRange(0, 0);
    this.material = new LineBasicMaterial({
      color: 0xbcd6ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new LineSegments(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.scene.add(this.mesh);

    this.refresh(true);
    this.scene.beforeRenderCbs.push(this.update);
    this.ready.resolve();
  }

  private refresh(force: boolean): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!force && now - this.lastRefresh < REFRESH_MS) return;
    this.lastRefresh = now;
    const forced = forcedWeather(new URLSearchParams(window.location.search).get('weather'));
    this.state = forced ?? weatherFor(this.world, new Date());

    const count = rainDropCount(this.state, this.drops);
    this.material.opacity = rainOpacity(this.state);
    this.mesh.visible = count > 0;
    this.mesh.geometry.setDrawRange(0, count * 2);
  }

  private update = () => {
    if (this.suspended) {
      this.mesh.visible = false;
      return;
    }
    this.refresh(false);
    const count = rainDropCount(this.state, this.drops);
    if (count === 0) return;

    // Follow the local player; fall back to the camera (audit screens have no
    // spawned avatar). Bail out if both are non-finite.
    const player = this.scene.characters?.mesh?._localObject?.position;
    if (player && Number.isFinite(player.x)) this.anchor.set(player.x, 0, player.z);
    else {
      const cam = this.scene.camera.position;
      if (!Number.isFinite(cam.x)) return;
      this.anchor.set(cam.x, 0, cam.z);
    }
    this.mesh.position.copy(this.anchor);

    const dt = Math.min((clock.delta || 16) / 1000, 0.05);
    const fall = rainFallSpeed(this.state);
    const length = rainDropLength(this.state);
    const wind = this.state.wind * 4.5;
    const x0 = -HALF_SPAN;
    const span = HALF_SPAN * 2;

    for (let i = 0; i < count; i++) {
      let y = this.ys[i] - fall * dt;
      let x = this.xs[i] + wind * dt;
      if (y < BOTTOM) {
        y = TOP;
        x = x0 + this.rand() * span;
        this.zs[i] = x0 + this.rand() * span;
      }
      if (x < x0) x += span;
      else if (x > HALF_SPAN) x -= span;
      this.ys[i] = y;
      this.xs[i] = x;

      const o = i * 6;
      this.positions[o] = x;
      this.positions[o + 1] = y;
      this.positions[o + 2] = this.zs[i];
      this.positions[o + 3] = x - (wind / Math.max(fall, 1)) * length;
      this.positions[o + 4] = y + length;
      this.positions[o + 5] = this.zs[i];
    }

    (this.mesh.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
  };
}
