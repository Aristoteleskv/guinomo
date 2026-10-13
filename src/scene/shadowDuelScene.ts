// B8 — Duelo de sombras (scene). During a world's daily event a "shadow"
// projection gathers at the meeting spot. Walking near it challenges you: the
// strike pattern is deterministic (seeded by world + UTC day — everyone faces
// the same schedule), the projection telegraphs each strike with a cyan flash,
// and pressing F (or the on-screen blade) parries inside the window. Every
// finished duel saves a replay anyone can re-arbitrate offline with the same
// seed (core/shadowDuel.ts) — no server involved.

import { Mesh, MeshBasicMaterial, RingGeometry, SphereGeometry } from 'three';
import { events } from '../core/events';
import { clock } from '../engine/clock';
import { playSfx } from '../engine/sfx';
import { showToast } from '../components/toast';
import { getWorldId, type WorldId } from '../core/worlds';
import { meetingSpotFor } from '../core/friendsLight';
import { minutesOf, worldEvent } from '../core/worldRhythm';
import {
  arbitrateDuel,
  duelPattern,
  duelReplay,
  duelSeed,
  validateReplay,
  DUEL_STRIKES,
  DUEL_WINDOW_MS,
  TELEGRAPH_MS,
  type DuelPattern,
  type DuelReplay,
  type DuelVerdict,
} from '../core/shadowDuel';
import { SceneModule } from './SceneModule';
import './shadowDuel.css';

const DUEL_RANGE = 6.5;
const ABORT_LEEWAY = 3; // extra metres before a duel is abandoned
const SHADOW_Y = 1.9; // height of the projection center over the spot
const RING_Y = 0.06; // ground ring just above the terrain
const MAX_SCORE = DUEL_STRIKES * 3;
const STORE_KEY = 'guinomo.shadow_duel.v1';
const STORE_CAP = 30;

const RING_COLOR_IDLE = 0x7a5cff;
const RING_COLOR_TELEGRAPH = 0x8ff7ff;

interface VerdictCopy {
  icon: string;
  pt: string;
  en: string;
}

const VERDICTS: Record<DuelVerdict, VerdictCopy> = {
  critical: { icon: '⚡', pt: 'Duelo perfeito!', en: 'Perfect duel!' },
  win: { icon: '🗡️', pt: 'Dominaste a sombra!', en: 'You dominated the shadow!' },
  hold: { icon: '😤', pt: 'A sombra sustenta o olhar.', en: 'The shadow holds its gaze.' },
  lose: { icon: '🌒', pt: 'A sombra venceu desta vez.', en: 'The shadow wins this time.' },
};

export class ShadowDuelScene extends SceneModule {
  private world: WorldId = getWorldId(new URLSearchParams(window.location.search).get('world'));
  private spot = meetingSpotFor(this.world);

  private shadow: Mesh | null = null;
  private ring: Mesh | null = null;

  private pattern: DuelPattern | null = null;
  private duelStart = 0;
  private presses: number[] = [];
  private active = false;
  private awaitingExit = false; // after a duel: leave and come back to fight again
  private strikeIndex = 0;
  private struckCount = 0;
  private lastStrikeAt = 0;
  private parryAt = 0;

  private banner: HTMLDivElement | null = null;
  private blade: HTMLButtonElement | null = null;

  protected init() {
    // The projection sits over the meeting spot — always in the scene, only
    // visible while the world's daily event is running.
    this.createShadow();

    this.setupDom();

    events.on('keydown', this._onKey);
    this.scene.beforeRenderCbs.push(this.update);
    this.ready.resolve();
  }

  // ---- visuals ------------------------------------------------------------

  private createShadow(): void {
    const shadow = new Mesh(
      new SphereGeometry(0.85, 24, 18),
      new MeshBasicMaterial({ color: 0x160e2e, transparent: true, opacity: 0.92, depthWrite: false }),
    );
    shadow.position.set(this.spot.x, SHADOW_Y, this.spot.z);
    this.scene.add(shadow);
    this.shadow = shadow;

    const ring = new Mesh(
      new RingGeometry(1.0, 1.6, 32),
      new MeshBasicMaterial({ color: RING_COLOR_IDLE, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.spot.x, RING_Y, this.spot.z);
    this.scene.add(ring);
    this.ring = ring;
  }

  private setupDom(): void {
    let banner = document.getElementById('shadow-duel-banner') as HTMLDivElement | null;
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'shadow-duel-banner';
      banner.style.display = 'none';
      document.body.append(banner);
    }
    this.banner = banner;

    let blade = document.getElementById('shadow-duel-blade') as HTMLButtonElement | null;
    if (!blade) {
      blade = document.createElement('button');
      blade.id = 'shadow-duel-blade';
      blade.type = 'button';
      blade.textContent = '⚔️';
      blade.setAttribute('aria-label', 'Duelo de sombras — parry');
      blade.style.display = 'none';
      blade.addEventListener('pointerdown', () => this.parry());
      document.body.append(blade);
    }
    this.blade = blade;
  }

  private showBanner(on: boolean): void {
    const banner = this.banner;
    if (!banner) return;
    if (on) {
      banner.textContent = this.text(
        '⚔️ Duelo de sombras — carrega F quando a projeção brilhar',
        '⚔️ Shadow duel — press F when the projection flashes',
      );
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
    if (this.blade) this.blade.style.display = on ? 'grid' : 'none';
  }

  private showResult(result: { score: number; verdict: DuelVerdict }, best: number | null): void {
    const existing = document.getElementById('shadow-duel-result');
    if (existing) existing.remove();

    const copy = VERDICTS[result.verdict];
    const card = document.createElement('div');
    card.id = 'shadow-duel-result';
    if (result.verdict === 'critical') card.classList.add('verdict-critical');

    const icon = document.createElement('div');
    icon.className = 'duel-icon';
    icon.textContent = copy.icon;

    const title = document.createElement('div');
    title.className = 'duel-title';
    title.textContent = this.text(copy.pt, copy.en);

    const sub = document.createElement('div');
    sub.className = 'duel-sub';
    sub.textContent = this.bestLine(result, best, this.stateLine());

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'duel-close';
    close.textContent = this.text('fechar', 'close');
    close.addEventListener('click', () => card.remove());

    card.append(icon, title, sub, close);
    document.body.append(card);
  }

  private stateLine(): string {
    return this.text(
      `${this.presses.length} cargas registadas`,
      `${this.presses.length} presses recorded`,
    );
  }

  private bestLine(result: { score: number }, best: number | null, state: string): string {
    const score = this.text(
      `Pontos ${result.score} / ${MAX_SCORE}${best !== null ? ` · melhor ${best}` : ''}`,
      `Score ${result.score} / ${MAX_SCORE}${best !== null ? ` · best ${best}` : ''}`,
    );
    return `${score} · ${state}`;
  }

  // ---- duel machine ---------------------------------------------------------

  private beginDuel(): void {
    const minutes = minutesOf(new Date());
    this.pattern = duelPattern(duelSeed(this.world, minutes));
    this.duelStart = performance.now();
    this.presses = [];
    this.active = true;
    this.awaitingExit = false;
    this.strikeIndex = 0;
    this.struckCount = 0;
    this.lastStrikeAt = 0;
    this.parryAt = 0;
    playSfx('guide');
    this.showBanner(true);
  }

  private parry(): void {
    if (!this.active) return;
    this.presses.push(performance.now() - this.duelStart);
    this.parryAt = performance.now();
    playSfx('open');
  }

  private finishDuel(): void {
    const minutes = minutesOf(new Date());
    const seed = this.pattern?.seed ?? duelSeed(this.world, minutes);
    const result = arbitrateDuel(seed, this.presses);
    this.active = false;
    this.awaitingExit = true;

    const replay = duelReplay(this.world, minutes, window.GUINOMO_UID ?? 1, this.presses);
    this.saveReplay(replay);
    const best = this.bestScore(replay.world, replay.day);

    this.showBanner(false);
    this.showResult({ score: result.score, verdict: result.verdict }, best);
    if (result.verdict === 'critical' || result.verdict === 'win') playSfx('travel');
  }

  private abortDuel(): void {
    this.active = false;
    this.awaitingExit = true;
    this.showBanner(false);
    showToast(this.text('O duelo foi interrompido.', 'The duel was interrupted.'), 'neutral');
  }

  // ---- storage --------------------------------------------------------------

  private loadReplays(): DuelReplay[] {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as DuelReplay[]) : [];
    } catch {
      return [];
    }
  }

  private saveReplay(replay: DuelReplay): void {
    try {
      const replays = [replay, ...this.loadReplays()].slice(0, STORE_CAP);
      localStorage.setItem(STORE_KEY, JSON.stringify(replays));
    } catch {
      // Storage is a progressive enhancement; the duel still plays.
    }
  }

  private bestScore(world: WorldId, day: number): number | null {
    const minutes = minutesOf(new Date());
    let best: number | null = null;
    for (const replay of this.loadReplays()) {
      if (replay.world !== world || replay.day !== day) continue;
      if (!validateReplay(replay, minutes)) continue;
      const score = arbitrateDuel(replay.seed, replay.presses).score;
      if (best === null || score > best) best = score;
    }
    return best;
  }

  // ---- per-frame -------------------------------------------------------------

  private update = () => {
    const shadow = this.shadow;
    const ring = this.ring;
    if (!shadow || !ring) return;

    const inEvent = worldEvent(this.world, minutesOf(new Date())) !== null;
    shadow.visible = ring.visible = inEvent;
    if (!inEvent) {
      if (this.active) this.abortDuel();
      return;
    }

    const t = clock.time;
    const local = this.scene.characters?.mesh?._localObject;
    const dist = local
      ? Math.hypot(local.position.x - this.spot.x, local.position.z - this.spot.z)
      : Infinity;

    if (!this.active) {
      // Gentle idle presence…
      const idleRing = ring.material as MeshBasicMaterial;
      shadow.position.y = SHADOW_Y + 0.14 * Math.sin(t * 1.1);
      ring.scale.setScalar(1 + 0.04 * Math.sin(t * 0.9));
      idleRing.color.setHex(RING_COLOR_IDLE);
      idleRing.opacity = 0.8;

      // …that challenges anyone who gets close. After a duel, step away and
      // come back to face it again (no re-triggering while standing still).
      if (dist > DUEL_RANGE + ABORT_LEEWAY) this.awaitingExit = false;
      if (!this.awaitingExit && dist <= DUEL_RANGE) this.beginDuel();
      return;
    }

    // Active duel.
    const elapsed = performance.now() - this.duelStart;
    if (dist > DUEL_RANGE + ABORT_LEEWAY) {
      this.abortDuel();
      return;
    }
    if (elapsed >= DUEL_WINDOW_MS) {
      this.finishDuel();
      return;
    }

    shadow.position.y = SHADOW_Y + 0.2 * Math.sin(t * 2.2);

    // Telegraph: the next strike flashes cyan TELEGRAPH_MS before it hits.
    const strikes = this.pattern?.strikes ?? [];
    while (this.strikeIndex < strikes.length && elapsed >= strikes[this.strikeIndex]) this.strikeIndex++;
    const next = strikes[this.strikeIndex];
    const telegraphing = next !== undefined && elapsed >= next - TELEGRAPH_MS && elapsed < next;

    // Strike impact (once per strike, when the moment passes).
    if (this.struckCount < this.strikeIndex) {
      this.struckCount = this.strikeIndex;
      this.lastStrikeAt = performance.now();
      playSfx('secret');
    }

    const strikePulse =
      this.struckCount > 0 ? 0.28 * Math.max(0, 1 - (performance.now() - this.lastStrikeAt) / 450) : 0;
    shadow.scale.setScalar(1 + strikePulse);

    const ringMaterial = ring.material as MeshBasicMaterial;
    const parryPulse = this.parryAt > 0 ? 0.35 * Math.max(0, 1 - (performance.now() - this.parryAt) / 250) : 0;
    if (telegraphing) {
      ringMaterial.color.setHex(RING_COLOR_TELEGRAPH);
      ringMaterial.opacity = 1;
      ring.scale.setScalar(1.3 + 0.22 * Math.sin(t * 14) + parryPulse);
    } else {
      ringMaterial.color.setHex(RING_COLOR_IDLE);
      ringMaterial.opacity = 0.8;
      ring.scale.setScalar(1 + parryPulse);
    }
  };

  private _onKey = (e: KeyboardEvent) => {
    if (e.code === 'KeyF' && !e.repeat) this.parry();
  };

  private text(pt: string, en: string): string {
    return window.GUINOMO_PROFILE?.language === 'en' ? en : pt;
  }
}