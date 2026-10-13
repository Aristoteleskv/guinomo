// Avatar-vs-avatar duel (real PvP). Press R near another avatar to challenge
// them; they press R to accept. Both then face the SAME deterministic strike
// pattern (the seed is derived from the duel nonce, so it is identical on both
// machines) and parry with R. Each side broadcasts its own press record over
// the existing chat channel; because arbitration is a pure function of
// (seed, presses) — core/avatarDuel.ts built on core/shadowDuel.ts — both
// clients compute identical scores and agree on the winner. No server, no
// trust: each player can only "lie" about their own timing, and that timing is
// judged against the shared pattern everywhere.

import { Mesh, MeshBasicMaterial, RingGeometry } from 'three';
import { events } from '../core/events';
import { clock } from '../engine/clock';
import { playSfx } from '../engine/sfx';
import { showToast } from '../components/toast';
import {
  avatarDuelNonce,
  avatarDuelSeed,
  encodeAccept,
  encodeChallenge,
  encodeResult,
  parseAvatarDuel,
  resolveAvatarDuel,
  type AvatarDuelOutcome,
} from '../core/avatarDuel';
import { DUEL_WINDOW_MS, TELEGRAPH_MS, duelPattern, type DuelPattern } from '../core/shadowDuel';
import { SceneModule } from './SceneModule';
import './avatarDuel.css';

const CHALLENGE_RANGE = 6; // metres
const CHALLENGE_TIMEOUT_MS = 8000; // invite / accept window
const RESULT_TIMEOUT_MS = 6000; // wait for the opponent's press record
const RING_Y = 0.07;
const RING_COLOR_MINE = 0x6ee7ff;
const RING_COLOR_THEIRS = 0xff8fb0;

type Phase = 'idle' | 'waiting' | 'incoming' | 'duel' | 'waitingResult';

interface RemoteAvatar {
  id: string;
  uid: number;
  name: string;
}

export class AvatarDuelScene extends SceneModule {
  private phase: Phase = 'idle';
  private nonce = 0;
  private opponentUid = 0;
  private opponentName = '';

  private pattern: DuelPattern | null = null;
  private duelStart = 0;
  private presses: number[] = [];
  private deadline = 0;
  private opponentPresses: number[] | null = null;

  private strikeIndex = 0;
  private struckCount = 0;
  private lastStrikeAt = 0;
  private parryAt = 0;

  private myRing: Mesh | null = null;
  private theirRing: Mesh | null = null;
  private banner: HTMLDivElement | null = null;
  private button: HTMLButtonElement | null = null;

  protected init() {
    this.setupDom();
    events.on('keydown', this._onKey);
    events.on('p2p_chat', this._onChat);
    this.scene.beforeRenderCbs.push(this.update);
    this.ready.resolve();
  }

  // ---- DOM ------------------------------------------------------------------

  private setupDom(): void {
    let banner = document.getElementById('avatar-duel-banner') as HTMLDivElement | null;
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'avatar-duel-banner';
      banner.style.display = 'none';
      document.body.append(banner);
    }
    this.banner = banner;

    let button = document.getElementById('avatar-duel-btn') as HTMLButtonElement | null;
    if (!button) {
      button = document.createElement('button');
      button.id = 'avatar-duel-btn';
      button.type = 'button';
      button.style.display = 'none';
      button.addEventListener('pointerdown', () => this.act());
      document.body.append(button);
    }
    this.button = button;

    this.myRing = this.makeRing(RING_COLOR_MINE);
    this.theirRing = this.makeRing(RING_COLOR_THEIRS);
  }

  private makeRing(color: number): Mesh {
    const ring = new Mesh(
      new RingGeometry(0.62, 0.95, 32),
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    this.scene.add(ring);
    return ring;
  }

  private setButton(label: string | null): void {
    const button = this.button;
    if (!button) return;
    if (label === null) {
      button.style.display = 'none';
      return;
    }
    button.textContent = label;
    button.style.display = 'grid';
  }

  private showBanner(message: string): void {
    const banner = this.banner;
    if (!banner) return;
    banner.textContent = message;
    banner.classList.remove('telegraph', 'strike');
    banner.style.display = 'block';
  }

  private hideBanner(): void {
    const banner = this.banner;
    if (banner) banner.style.display = 'none';
  }

  private showOutcome(outcome: AvatarDuelOutcome): void {
    const existing = document.getElementById('avatar-duel-result');
    if (existing) existing.remove();

    const win = outcome.verdict === 'win';
    const draw = outcome.verdict === 'draw';
    const card = document.createElement('div');
    card.id = 'avatar-duel-result';
    card.className = win ? 'verdict-win' : draw ? 'verdict-draw' : 'verdict-lose';

    const icon = document.createElement('div');
    icon.className = 'duel-icon';
    icon.textContent = win ? '🏆' : draw ? '🤝' : '💫';

    const title = document.createElement('div');
    title.className = 'duel-title';
    title.textContent = win
      ? this.text(`Venceste ${this.opponentName}!`, `You beat ${this.opponentName}!`)
      : draw
        ? this.text('Empate!', 'A draw!')
        : this.text(`${this.opponentName} venceu.`, `${this.opponentName} won.`);

    const sub = document.createElement('div');
    sub.className = 'duel-sub';
    sub.textContent = this.text(
      `Tu ${outcome.mine.score} — ${outcome.theirs.score} ${this.opponentName}`,
      `You ${outcome.mine.score} — ${outcome.theirs.score} ${this.opponentName}`,
    );

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'duel-close';
    close.textContent = this.text('fechar', 'close');
    close.addEventListener('click', () => card.remove());

    card.append(icon, title, sub, close);
    document.body.append(card);
  }

  // ---- actions --------------------------------------------------------------

  /** Key/button action — meaning depends on the current phase. */
  private act(): void {
    if (this.phase === 'idle') this.challengeNearest();
    else if (this.phase === 'incoming') this.acceptIncoming();
    else if (this.phase === 'duel') this.parry();
  }

  private challengeNearest(): void {
    const myUid = this.myUid();
    if (myUid <= 0) {
      showToast(
        this.text('Entra na tua conta para duelar.', 'Sign in to duel.'),
        'neutral',
      );
      return;
    }
    const target = this.nearestRemote();
    if (!target) {
      showToast(
        this.text('Ninguém por perto para desafiar.', 'Nobody nearby to duel.'),
        'neutral',
      );
      return;
    }
    this.nonce = avatarDuelNonce();
    this.opponentUid = target.uid;
    this.opponentName = target.name;
    events.emit('p2p_send_chat', encodeChallenge(this.nonce, myUid, target.uid));
    this.phase = 'waiting';
    this.deadline = performance.now() + CHALLENGE_TIMEOUT_MS;
    this.setButton('…');
    this.showBanner(this.text(`Desafiaste ${target.name} — à espera…`, `You challenged ${target.name} — waiting…`));
    playSfx('guide');
  }

  private acceptIncoming(): void {
    const myUid = this.myUid();
    events.emit('p2p_send_chat', encodeAccept(this.nonce, myUid, this.opponentUid));
    this.startDuel();
  }

  private startDuel(): void {
    this.pattern = duelPattern(avatarDuelSeed(this.nonce));
    this.duelStart = performance.now();
    this.presses = [];
    this.opponentPresses = null;
    this.strikeIndex = 0;
    this.struckCount = 0;
    this.lastStrikeAt = 0;
    this.parryAt = 0;
    this.phase = 'duel';
    this.deadline = 0;
    this.setButton('⚔️');
    this.showBanner(this.text('⚔️ Duelo — carrega R quando brilhar', '⚔️ Duel — press R when it flashes'));
    playSfx('guide');
  }

  private parry(): void {
    if (this.phase !== 'duel') return;
    this.presses.push(performance.now() - this.duelStart);
    this.parryAt = performance.now();
    playSfx('open');
  }

  private endDuel(): void {
    const myUid = this.myUid();
    events.emit('p2p_send_chat', encodeResult(this.nonce, myUid, this.presses));
    this.phase = 'waitingResult';
    this.deadline = performance.now() + RESULT_TIMEOUT_MS;
    this.setButton('…');
    this.showBanner(this.text('À espera do resultado do adversário…', 'Waiting for the opponent’s result…'));

    if (this.opponentPresses) this.finishDuel();
  }

  private finishDuel(): void {
    const seed = avatarDuelSeed(this.nonce);
    const outcome = resolveAvatarDuel(seed, this.presses, this.opponentPresses ?? []);
    this.reset();
    this.showOutcome(outcome);
    if (outcome.verdict === 'win') playSfx('travel');
    else if (outcome.verdict === 'lose') playSfx('close');
  }

  private cancel(message: string): void {
    this.reset();
    showToast(message, 'neutral');
  }

  private reset(): void {
    this.phase = 'idle';
    this.pattern = null;
    this.opponentUid = 0;
    this.opponentPresses = null;
    this.presses = [];
    this.deadline = 0;
    this.strikeIndex = 0;
    this.struckCount = 0;
    this.lastStrikeAt = 0;
    this.parryAt = 0;
    this.setButton(null);
    this.hideBanner();
    if (this.myRing) this.myRing.visible = false;
    if (this.theirRing) this.theirRing.visible = false;
  }

  // ---- network --------------------------------------------------------------

  private _onChat = (chat: { from?: string; uid?: number; name?: string; text?: string }) => {
    const message = parseAvatarDuel(chat?.text);
    if (!message) return;
    const myUid = this.myUid();

    if (message.kind === 'challenge') {
      if (message.to !== myUid || message.from === myUid) return;
      if (this.phase !== 'idle') return;
      this.nonce = message.nonce;
      this.opponentUid = message.from;
      this.opponentName = (chat.name ?? '').trim() || `User ${message.from}`;
      this.phase = 'incoming';
      this.deadline = performance.now() + CHALLENGE_TIMEOUT_MS;
      this.setButton('⚔️');
      this.showBanner(
        this.text(
          `${this.opponentName} desafiou-te — carrega R para aceitar`,
          `${this.opponentName} challenged you — press R to accept`,
        ),
      );
      playSfx('secret');
      return;
    }

    if (message.nonce !== this.nonce) return;

    if (message.kind === 'accept') {
      if (this.phase === 'waiting') this.startDuel();
      return;
    }

    // Result — only trust the opponent we are actually duelling.
    if (message.uid !== this.opponentUid) return;
    this.opponentPresses = message.presses;
    if (this.phase === 'waitingResult') this.finishDuel();
  };

  private _onKey = (event: KeyboardEvent) => {
    if (event.code !== 'KeyR' || event.repeat) return;
    const focused = document.activeElement;
    if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) return;
    this.act();
  };

  // ---- lookup / per-frame ---------------------------------------------------

  private myUid(): number {
    return window.GUINOMO_UID ?? 0;
  }

  private nearestRemote(): RemoteAvatar | null {
    const mesh = this.scene.characters?.mesh;
    const local = mesh?._localObject;
    if (!mesh || !local) return null;
    let best: RemoteAvatar | null = null;
    let bestDist = CHALLENGE_RANGE;
    for (const [id, object] of mesh._charactersObjects) {
      if (id === 'local') continue;
      const uid = object.userData.uid ?? 0;
      if (uid <= 0) continue;
      const dist = Math.hypot(object.position.x - local.position.x, object.position.z - local.position.z);
      if (dist <= bestDist) {
        bestDist = dist;
        best = {
          id,
          uid,
          name: (object.userData.name as string | undefined)?.trim() || `User ${uid}`,
        };
      }
    }
    return best;
  }

  private remoteByUid(uid: number) {
    const mesh = this.scene.characters?.mesh;
    if (!mesh || uid <= 0) return null;
    for (const [id, object] of mesh._charactersObjects) {
      if (id === 'local') continue;
      if ((object.userData.uid ?? 0) === uid) return { id, object };
    }
    return null;
  }

  private update = () => {
    const now = performance.now();

    if (this.phase === 'waiting' && now > this.deadline) {
      this.cancel(this.text('Sem resposta ao desafio.', 'No answer to the challenge.'));
      return;
    }
    if (this.phase === 'incoming' && now > this.deadline) {
      this.cancel(this.text('O desafio expirou.', 'The challenge expired.'));
      return;
    }
    if (this.phase === 'waitingResult' && now > this.deadline) {
      this.finishDuel();
      return;
    }

    if (this.phase !== 'duel' || !this.pattern) {
      this.updateRings(false);
      return;
    }

    const elapsed = now - this.duelStart;
    if (elapsed >= DUEL_WINDOW_MS) {
      this.endDuel();
      return;
    }

    const t = clock.time;
    const strikes = this.pattern.strikes;
    while (this.strikeIndex < strikes.length && elapsed >= strikes[this.strikeIndex]) this.strikeIndex++;
    const next = strikes[this.strikeIndex];
    const telegraphing = next !== undefined && elapsed >= next - TELEGRAPH_MS && elapsed < next;

    if (this.struckCount < this.strikeIndex) {
      this.struckCount = this.strikeIndex;
      this.lastStrikeAt = now;
      playSfx('secret');
    }

    const banner = this.banner;
    if (banner) {
      banner.classList.toggle('telegraph', telegraphing);
      const strikeAge = now - this.lastStrikeAt;
      banner.classList.toggle('strike', this.lastStrikeAt > 0 && strikeAge < 220);
    }

    const myRing = this.myRing;
    if (myRing) {
      const pulse = 1 + 0.12 * Math.sin(t * 6) + (this.parryAt > 0 ? 0.3 * Math.max(0, 1 - (now - this.parryAt) / 250) : 0);
      myRing.scale.setScalar(pulse);
    }
    this.updateRings(true, telegraphing, t);
  };

  private updateRings(visible: boolean, telegraphing = false, t = 0): void {
    const mesh = this.scene.characters?.mesh;
    const local = mesh?._localObject;
    const myRing = this.myRing;
    const theirRing = this.theirRing;
    if (!myRing || !theirRing) return;

    myRing.visible = visible && !!local;
    if (local) myRing.position.set(local.position.x, local.position.y + RING_Y, local.position.z);

    const opponent = visible ? this.remoteByUid(this.opponentUid) : null;
    theirRing.visible = visible && !!opponent;
    if (opponent) {
      theirRing.position.set(opponent.object.position.x, opponent.object.position.y + RING_Y, opponent.object.position.z);
      const material = theirRing.material as MeshBasicMaterial;
      material.opacity = telegraphing ? 1 : 0.8;
      theirRing.scale.setScalar(telegraphing ? 1.25 + 0.2 * Math.sin(t * 14) : 1);
    }
  }

  private text(pt: string, en: string): string {
    return window.GUINOMO_PROFILE?.language === 'en' ? en : pt;
  }
}
