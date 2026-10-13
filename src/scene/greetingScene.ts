// Saudação (greeting) — the non-invasive wave, now in REAL 3D. A 👋 travels
// over the existing plain-text P2P chat channel (no protocol change; see
// core/greeting.ts); every client then raises the greeter's *actual arm bones*
// (engine/characters.ts, core/wavePose.ts — no new animation clip) and lifts a
// rising ring of particles. Works locally and for friends: the remote is
// resolved by the chat's `from` client id in the characters registry. The
// avatar's model/shaders are untouched.

import { CanvasTexture, Group, Object3D, Sprite, SpriteMaterial, sRGBEncoding } from 'three';
import { events } from '../core/events';
import { clock } from '../engine/clock';
import { playSfx } from '../engine/sfx';
import { minutesOf } from '../core/worldRhythm';
import { WAVE_DURATION_MS } from '../core/wavePose';
import {
  greetingBurst,
  greetingMessage,
  greetingSeed,
  isGreetingText,
  type GreetingParticle,
} from '../core/greeting';
import { SceneModule } from './SceneModule';
import './greeting.css';

interface ActiveGreeting {
  target: Object3D;
  born: number;
  seed: number;
  group: Group;
  particles: Sprite[];
  burst: GreetingParticle[];
}

const GREET_COOLDOWN_MS = 1200;
const RING_DURATION_S = WAVE_DURATION_MS / 1000;

export class GreetingScene extends SceneModule {
  private dotTexture: CanvasTexture | null = null;
  private active: ActiveGreeting[] = [];
  private lastGreet = -Infinity;

  protected init() {
    this.dotTexture = makeDotTexture();
    this.mountButton();

    events.on('p2p_chat', this.onRemoteChat);
    events.on('p2p_send_chat', this.onLocalSend);
    events.on('keydown', this.onKey);
    this.scene.beforeRenderCbs.push(this.update);
    this.ready.resolve();
  }

  private mountButton(): void {
    if (document.getElementById('guinomo-greet')) return;
    const button = document.createElement('button');
    button.id = 'guinomo-greet';
    button.type = 'button';
    button.textContent = '👋';
    button.setAttribute('aria-label', this.text('Saudar', 'Wave'));
    button.title = this.text('Saudar (G)', 'Wave (G)');
    button.addEventListener('click', () => this.greet());
    document.body.append(button);
  }

  /** Wave to the world: travels over the chat channel and lights up here too. */
  private greet(): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastGreet < GREET_COOLDOWN_MS) return;
    this.lastGreet = now;
    playSfx('open');
    events.emit('p2p_send_chat', greetingMessage());
  }

  private onKey = (event: KeyboardEvent) => {
    if (event.code !== 'KeyG' || event.repeat) return;
    const focused = document.activeElement;
    if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) return;
    this.greet();
  };

  /** A local chat/emoji/sticker containing a 👋 waves the local avatar. */
  private onLocalSend = (text: string) => {
    if (!isGreetingText(text)) return;
    const local = this.scene.characters?.mesh?._localObject;
    if (local) this.spawn(local, greetingSeed(window.GUINOMO_UID ?? 0, minutesOf(new Date())));
  };

  /** A friend's wave (received over the chat channel) waves their avatar. */
  private onRemoteChat = (chat: { from?: string; uid?: number; text?: string }) => {
    if (!isGreetingText(chat?.text)) return;
    const remote = chat.from ? this.scene.characters?.mesh?._charactersObjects?.get(chat.from) : undefined;
    if (remote) this.spawn(remote, greetingSeed(chat.uid ?? 0, minutesOf(new Date())));
  };

  private spawn(target: Object3D, seed: number): void {
    if (!this.dotTexture) return;

    // The engine reads this and poses the arm on top of the blended animation.
    target.userData.waveStart =
      typeof performance !== 'undefined' ? performance.now() : Date.now();

    const group = new Group();
    const burst = greetingBurst(seed);
    const particles = burst.map(() => {
      const sprite = new Sprite(
        new SpriteMaterial({
          map: this.dotTexture,
          transparent: true,
          depthWrite: false,
          color: 0xfff2c8,
        }),
      );
      sprite.scale.setScalar(0.2);
      group.add(sprite);
      return sprite;
    });

    this.scene.add(group);
    this.active.push({ target, born: Date.now(), seed, group, particles, burst });
  }

  private update = () => {
    if (this.active.length === 0) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const time = clock.time;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const greeting = this.active[i];
      const age = (now - greeting.born) / 1000;
      if (age >= RING_DURATION_S) {
        this.disposeGreeting(greeting);
        this.active.splice(i, 1);
        continue;
      }

      const progress = age / RING_DURATION_S;
      const fade = progress < 0.12 ? progress / 0.12 : Math.min(1, (1 - progress) / 0.35);
      const base = greeting.target.position;
      greeting.group.position.set(base.x, base.y + 0.08, base.z);
      greeting.group.rotation.y = time * 0.6 + greeting.seed;

      greeting.particles.forEach((sprite, index) => {
        const particle = greeting.burst[index];
        const rise = Math.max(0, Math.min(1, (progress - particle.phase * 0.15) / 0.85));
        const radius = 0.55 + rise * 1.05;
        sprite.position.set(particle.dx * radius, 0.15 + particle.dy * rise * 1.5, particle.dz * radius);
        sprite.scale.setScalar(0.12 + 0.12 * (1 - rise));
        sprite.material.opacity = Math.max(0, fade * (1 - rise));
      });
    }
  };

  private disposeGreeting(greeting: ActiveGreeting): void {
    this.scene.remove(greeting.group);
    greeting.particles.forEach((sprite) => sprite.material.dispose());
  }

  private text(pt: string, en: string): string {
    return window.GUINOMO_PROFILE?.language === 'en' ? en : pt;
  }
}

/** A soft neon dot used for the greeting particles. */
function makeDotTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is required to render the greeting particles.');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,242,200,0.85)');
  gradient.addColorStop(1, 'rgba(255,242,200,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas);
  texture.encoding = sRGBEncoding;
  return texture;
}
