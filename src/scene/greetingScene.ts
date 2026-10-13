// Saudação (greeting) — the non-invasive wave. A 👋 travels over the existing
// plain-text P2P chat channel (no protocol change; see core/greeting.ts) and
// every client lifts a floating 👋 + a ring of particles over the greeter's
// avatar. Works locally and for friends: the remote is resolved by the chat's
// `from` client id in the characters registry. The avatar's model is untouched
// (no new animation clip needed).

import { CanvasTexture, Group, Object3D, Sprite, SpriteMaterial, sRGBEncoding } from 'three';
import { events } from '../core/events';
import { clock } from '../engine/clock';
import { playSfx } from '../engine/sfx';
import { minutesOf } from '../core/worldRhythm';
import {
  greetingBurst,
  greetingMessage,
  greetingSeed,
  isGreetingText,
  GREETING_DURATION,
  type GreetingParticle,
} from '../core/greeting';
import { SceneModule } from './SceneModule';
import './greeting.css';

interface ActiveGreeting {
  target: Object3D;
  born: number;
  seed: number;
  group: Group;
  hand: Sprite;
  particles: Sprite[];
  burst: GreetingParticle[];
}

const GREET_COOLDOWN_MS = 1200;
const HAND_Y = 2.1; // height of the raised hand above the avatar's feet

export class GreetingScene extends SceneModule {
  private handTexture: CanvasTexture | null = null;
  private dotTexture: CanvasTexture | null = null;
  private active: ActiveGreeting[] = [];
  private lastGreet = -Infinity;

  protected init() {
    this.handTexture = makeHandTexture();
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
    const now = performance.now();
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
    if (!this.handTexture || !this.dotTexture) return;

    const group = new Group();
    const hand = new Sprite(
      new SpriteMaterial({ map: this.handTexture, transparent: true, depthWrite: false }),
    );
    hand.scale.set(1.15, 1.15, 1);
    group.add(hand);

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
    this.active.push({ target, born: performance.now(), seed, group, hand, particles, burst });
  }

  private update = () => {
    if (this.active.length === 0) return;
    const now = performance.now();
    const time = clock.time;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const greeting = this.active[i];
      const age = (now - greeting.born) / 1000;
      if (age >= GREETING_DURATION) {
        this.disposeGreeting(greeting);
        this.active.splice(i, 1);
        continue;
      }

      const progress = age / GREETING_DURATION;
      const fade = progress < 0.12 ? progress / 0.12 : Math.min(1, (1 - progress) / 0.35);
      const base = greeting.target.position;
      greeting.group.position.set(
        base.x,
        base.y + HAND_Y + 0.12 * Math.sin(time * 3 + greeting.seed),
        base.z,
      );
      greeting.hand.rotation.z = 0.28 * Math.sin(time * 9 + greeting.seed);
      greeting.hand.material.opacity = Math.max(0, fade);

      greeting.particles.forEach((sprite, index) => {
        const particle = greeting.burst[index];
        const rise = Math.max(0, Math.min(1, (progress - particle.phase * 0.15) / 0.85));
        const radius = 0.5 + rise * 1.1;
        sprite.position.set(particle.dx * radius, particle.dy * rise * 1.5, particle.dz * radius);
        sprite.scale.setScalar(0.12 + 0.12 * (1 - rise));
        sprite.material.opacity = Math.max(0, fade * (1 - rise));
      });
    }
  };

  private disposeGreeting(greeting: ActiveGreeting): void {
    this.scene.remove(greeting.group);
    greeting.hand.material.dispose();
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

/** The raised 👋 drawn on a small canvas (no external asset). */
function makeHandTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is required to render the greeting.');
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '96px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  context.fillText('👋', 64, 70);
  const texture = new CanvasTexture(canvas);
  texture.encoding = sRGBEncoding;
  return texture;
}
