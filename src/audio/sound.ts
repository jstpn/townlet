/** Short sounds the game can ask for. Everything is synthesised; there are no audio files. */
export type Cue =
  'road' | 'zone' | 'building' | 'bulldoze' | 'error' | 'fire' | 'chime' | 'won' | 'lost';

const MUTED_KEY = 'townlet:muted';
const MASTER = 0.5;

/** The running graph: made all at once on the first gesture. */
type Audio = {
  ctx: AudioContext;
  master: GainNode;
  pad: GainNode;
  wash: BiquadFilterNode;
  noise: AudioBuffer;
};

/**
 * A sea-wash bed with a soft pad underneath, and small plucks and chimes for what the player
 * does. The context starts on the first gesture, as browsers require, and mute is remembered.
 * Muting suspends the context, so a silent game costs the device nothing.
 */
export class Sound {
  muted: boolean;
  private audio: Audio | undefined;
  private night = -1;

  constructor() {
    this.muted = readMuted();
    window.addEventListener('pointerdown', this.wake);
    window.addEventListener('keydown', this.wake);
  }

  toggle(): void {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTED_KEY, this.muted ? '1' : '0');
    } catch {
      // Private mode: the choice lasts for this visit.
    }
    this.wake();
    const a = this.audio;
    if (!a) return;
    if (this.muted) {
      a.master.gain.setTargetAtTime(0, a.ctx.currentTime, 0.05);
      setTimeout(() => void (this.muted && a.ctx.suspend()), 300);
    } else {
      a.master.gain.setTargetAtTime(MASTER, a.ctx.currentTime, 0.05);
      void a.ctx.resume();
    }
  }

  /** 0 by day, 1 at night: the pad drops and the wash softens. */
  setNight(t: number): void {
    const a = this.audio;
    if (!a || Math.abs(t - this.night) < 0.02) return;
    this.night = t;
    a.pad.gain.setTargetAtTime(0.02 - 0.012 * t, a.ctx.currentTime, 0.5);
    a.wash.frequency.setTargetAtTime(420 - 140 * t, a.ctx.currentTime, 0.5);
  }

  play(cue: Cue): void {
    const a = this.audio;
    if (this.muted || !a) return;
    const t = a.ctx.currentTime;
    switch (cue) {
      case 'road':
        this.pluck(a, t, 'triangle', 330, 220, 0.12, 0.22);
        break;
      case 'zone':
        this.pluck(a, t, 'sine', 523, 523, 0.1, 0.16);
        break;
      case 'building':
        this.pluck(a, t, 'triangle', 392, 392, 0.35, 0.18);
        this.pluck(a, t + 0.03, 'triangle', 587, 587, 0.35, 0.14);
        break;
      case 'bulldoze':
        this.pluck(a, t, 'sine', 90, 45, 0.25, 0.4);
        this.burst(a, t, 'lowpass', 260, 0.25, 0.5);
        break;
      case 'error':
        this.pluck(a, t, 'triangle', 300, 300, 0.08, 0.16);
        this.pluck(a, t + 0.1, 'triangle', 240, 240, 0.12, 0.16);
        break;
      case 'fire':
        for (let i = 0; i < 5; i++) this.burst(a, t + i * 0.07, 'bandpass', 1600, 0.08, 0.35);
        break;
      case 'chime':
        this.pluck(a, t, 'sine', 880, 880, 0.8, 0.16);
        this.pluck(a, t, 'sine', 1320, 1320, 0.6, 0.08);
        break;
      case 'won':
        [523, 659, 784, 1047].forEach((f, i) =>
          this.pluck(a, t + i * 0.12, 'sine', f, f, 0.7, 0.18),
        );
        break;
      case 'lost':
        [392, 349, 294].forEach((f, i) => this.pluck(a, t + i * 0.25, 'triangle', f, f, 0.6, 0.18));
        break;
    }
  }

  dispose(): void {
    window.removeEventListener('pointerdown', this.wake);
    window.removeEventListener('keydown', this.wake);
    void this.audio?.ctx.close();
    this.audio = undefined;
  }

  /** Starts the graph on the first gesture, and resumes it if the browser suspended it. */
  private readonly wake = (): void => {
    if (!this.audio) this.audio = this.start();
    else if (!this.muted && this.audio.ctx.state === 'suspended') void this.audio.ctx.resume();
  };

  private start(): Audio {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : MASTER;
    master.connect(ctx.destination);
    const noise = noiseBuffer(ctx, 3);

    // Sea wash: looped noise through a low filter, swelling slowly.
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const wash = ctx.createBiquadFilter();
    wash.type = 'lowpass';
    wash.frequency.value = 420;
    const washGain = ctx.createGain();
    washGain.gain.value = 0.05;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.07;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.03;
    swell.connect(swellDepth).connect(washGain.gain);
    source.connect(wash).connect(washGain).connect(master);
    source.start();
    swell.start();

    // A pad of two soft notes a fifth apart, barely there.
    const pad = ctx.createGain();
    pad.gain.value = 0.02;
    pad.connect(master);
    for (const f of [220, 329.6, 221.5]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.connect(pad);
      osc.start();
    }
    if (this.muted) void ctx.suspend();
    return { ctx, master, pad, wash, noise };
  }

  /** One note with a quick attack and an exponential decay, optionally gliding in pitch. */
  private pluck(
    a: Audio,
    at: number,
    type: OscillatorType,
    from: number,
    to: number,
    decay: number,
    peak: number,
  ): void {
    const osc = a.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + decay * 0.6);
    const env = a.ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(peak, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(env).connect(a.master);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }

  /** A puff of filtered noise. */
  private burst(
    a: Audio,
    at: number,
    type: BiquadFilterType,
    frequency: number,
    decay: number,
    peak: number,
  ): void {
    const src = a.ctx.createBufferSource();
    src.buffer = a.noise;
    const filter = a.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const env = a.ctx.createGain();
    env.gain.setValueAtTime(peak, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    src.connect(filter).connect(env).connect(a.master);
    src.start(at);
    src.stop(at + decay + 0.05);
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}
