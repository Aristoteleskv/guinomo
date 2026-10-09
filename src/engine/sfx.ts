// Synthesized UI sound effects (zero asset files): small clicks, a travel
// whoosh and a secret sparkle generated with the WebAudio API. The AudioContext
// is created lazily so autoplay policies are respected — before the first user
// interaction the master gain simply stays silent.

type SfxName = 'open' | 'close' | 'secret' | 'travel' | 'guide';

let context: AudioContext | null = null;
let master: GainNode | null = null;

function getContext(): AudioContext | null {
  try {
    if (!context) {
      const Ctor = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.2;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

function tone(frequency: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.5): void {
  const ctx = getContext();
  if (!ctx || !master) return;
  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const begin = ctx.currentTime + start;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, begin);
    gain.gain.setValueAtTime(0.0001, begin);
    gain.gain.exponentialRampToValueAtTime(volume, begin + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, begin + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(begin);
    oscillator.stop(begin + duration + 0.05);
  } catch {
    // Audio is a progressive enhancement; never let a sound break the game.
  }
}

export function playSfx(name: SfxName): void {
  switch (name) {
    case 'open':
      tone(392, 0, 0.09, 'sine', 0.5);
      tone(523.25, 0.05, 0.09, 'sine', 0.45);
      break;
    case 'close':
      tone(523.25, 0, 0.08, 'sine', 0.45);
      tone(392, 0.045, 0.09, 'sine', 0.4);
      break;
    case 'travel':
      tone(220, 0, 0.3, 'triangle', 0.6);
      tone(330, 0.06, 0.3, 'triangle', 0.5);
      tone(440, 0.12, 0.28, 'triangle', 0.4);
      break;
    case 'secret':
      tone(784, 0, 0.1, 'sine', 0.5);
      tone(988, 0.07, 0.1, 'sine', 0.5);
      tone(1175, 0.14, 0.14, 'sine', 0.5);
      tone(1568, 0.22, 0.2, 'sine', 0.4);
      break;
    case 'guide':
      tone(440, 0, 0.12, 'sine', 0.5);
      tone(660, 0.09, 0.18, 'sine', 0.5);
      break;
  }
}