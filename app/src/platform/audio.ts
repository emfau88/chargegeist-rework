/**
 * All sound is synthesised with WebAudio: no audio files, works offline.
 * Effects: tap, start, complete, tick and goal (the session result), flip (per rarity), keep, unlock, poke, and the gesture sounds
 * (a purring hum while stroked, a squeak when held, a pop on release, a giggle when tickled).
 * Ambient soundscapes: rain, brown noise, fireplace, night forest, ocean, café.
 */
import type { AmbientId } from '../state/store';
import type { Rarity } from '../data/types';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let fxOn = true;

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setFx(on: boolean) {
  fxOn = on;
  if (!on) purrOff();
}

function bell(freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine', partial = 2.76) {
  const c = ac();
  const t0 = c.currentTime + at;
  for (const [mul, g] of [
    [1, 1],
    [partial, 0.22],
    [2, 0.12],
  ] as const) {
    const o = c.createOscillator();
    const v = c.createGain();
    o.type = mul === 1 ? type : 'sine';
    o.frequency.value = freq * mul;
    v.gain.setValueAtTime(0, t0);
    v.gain.linearRampToValueAtTime(gain * g, t0 + 0.006);
    v.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * (mul === 1 ? 1 : 0.5));
    o.connect(v).connect(master!);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
}

function sweep(from: number, to: number, at: number, dur: number, gain: number) {
  const c = ac();
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const v = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(from, t0);
  o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  v.gain.setValueAtTime(0, t0);
  v.gain.linearRampToValueAtTime(gain, t0 + 0.02);
  v.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(v).connect(master!);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** A short burst of filtered noise (a slap or a clap). */
function slap(at: number, dur: number, gain: number, freq: number) {
  const c = ac();
  const t0 = c.currentTime + at;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 0.8;
  const v = c.createGain();
  v.gain.value = gain;
  src.connect(f).connect(v).connect(master!);
  src.start(t0);
}

const N = (semi: number) => 523.25 * 2 ** (semi / 12); // C5 based

export const sfx = {
  tap() {
    if (!fxOn) return;
    bell(N(7), 0, 0.09, 0.05);
  },
  toggle() {
    if (!fxOn) return;
    bell(N(12), 0, 0.07, 0.04);
  },
  start() {
    if (!fxOn) return;
    sweep(260, 780, 0, 0.35, 0.06);
    bell(N(0), 0.12, 0.6, 0.08);
    bell(N(7), 0.22, 0.7, 0.07);
  },
  complete() {
    if (!fxOn) return;
    [0, 4, 7, 12, 16].forEach((s, i) => bell(N(s), i * 0.09, 1.3 - i * 0.1, 0.09, 'triangle'));
  },
  /** One soft step up the scale for each line of the session result. */
  tick(i: number) {
    if (!fxOn) return;
    bell(N([7, 9, 12, 14, 16, 19][Math.min(Math.max(i, 0), 5)] ?? 7), 0, 0.2, 0.03);
  },
  /** The daily goal is reached: three bright notes. */
  goal() {
    if (!fxOn) return;
    [12, 19, 24].forEach((s, i) => bell(N(s), i * 0.07, 0.6 + i * 0.15, 0.05, 'triangle'));
  },
  poke() {
    if (!fxOn) return;
    sweep(500, 900, 0, 0.12, 0.05);
    bell(N(16), 0.06, 0.25, 0.04);
  },
  flip(r: Rarity) {
    if (!fxOn) return;
    sweep(300, 1400, 0, 0.18, 0.04);
    if (r === 'common') bell(N(7), 0.08, 0.5, 0.07);
    if (r === 'rare') [7, 12].forEach((s, i) => bell(N(s), 0.08 + i * 0.07, 0.7, 0.07));
    if (r === 'epic') [4, 7, 11, 16].forEach((s, i) => bell(N(s), 0.08 + i * 0.07, 0.9, 0.07, 'triangle'));
    if (r === 'mythic') {
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => bell(N(s), 0.08 + i * 0.06, 1.4, 0.07, 'triangle'));
      sweep(200, 2400, 0.1, 0.9, 0.03);
    }
  },
  keep() {
    if (!fxOn) return;
    [12, 7, 12, 19].forEach((s, i) => bell(N(s), i * 0.08, 0.8, 0.07));
  },
  unlock() {
    if (!fxOn) return;
    [0, 7, 12, 16, 19].forEach((s, i) => bell(N(s), i * 0.06, 1, 0.06, 'triangle'));
  },
  softEnd() {
    if (!fxOn) return;
    bell(N(-5), 0, 0.8, 0.06);
    bell(N(0), 0.15, 0.9, 0.05);
  },
  /** A soft hum with a purring flutter, while the ghost is stroked. */
  purr(on: boolean) {
    if (on && fxOn) purrOn();
    else purrOff();
  },
  squeak() {
    if (!fxOn) return;
    sweep(820, 1350, 0, 0.09, 0.035);
    sweep(1350, 1050, 0.09, 0.1, 0.03);
  },
  pop() {
    if (!fxOn) return;
    sweep(320, 760, 0, 0.1, 0.05);
    bell(N(12), 0.07, 0.3, 0.035);
  },
  /** A high five: a soft slap and a bright chime. */
  clap() {
    if (!fxOn) return;
    slap(0, 0.07, 0.09, 2200);
    bell(N(12), 0.02, 0.4, 0.04);
    bell(N(19), 0.08, 0.5, 0.03);
  },
  /** A hug: a warm rising chord. */
  hug() {
    if (!fxOn) return;
    [0, 4, 7, 12].forEach((s, i) => bell(N(s - 12), i * 0.09, 0.9, 0.035));
  },
  /** Hello: two bright notes. */
  hello() {
    if (!fxOn) return;
    bell(N(7), 0, 0.35, 0.035);
    bell(N(12), 0.13, 0.45, 0.035);
  },
  giggle() {
    if (!fxOn) return;
    [0, 1, 2, 3].forEach((i) => sweep(760 + i * 70, 1050 + i * 60, i * 0.085, 0.07, 0.03));
  },
};

/* the purr: two soft tones whose loudness flutters about 24 times a second */
let purrNodes: { out: GainNode; stop: () => void } | null = null;
function purrOn() {
  if (purrNodes) return;
  const c = ac();
  const out = c.createGain();
  out.gain.setValueAtTime(0, c.currentTime);
  out.gain.linearRampToValueAtTime(1, c.currentTime + 0.18);
  const flutter = c.createGain();
  flutter.gain.value = 0.5;
  const rate = c.createOscillator();
  rate.frequency.value = 24;
  const depth = c.createGain();
  depth.gain.value = 0.45;
  rate.connect(depth).connect(flutter.gain);
  const oscs = [
    [118, 'sine', 0.06],
    [236, 'triangle', 0.018],
  ].map(([f, type, g]) => {
    const o = c.createOscillator();
    o.type = type as OscillatorType;
    o.frequency.value = f as number;
    const v = c.createGain();
    v.gain.value = g as number;
    o.connect(v).connect(flutter);
    o.start();
    return o;
  });
  // a slow rise and fall of the pitch, like breathing
  const wob = c.createOscillator();
  wob.frequency.value = 0.9;
  const wobD = c.createGain();
  wobD.gain.value = 6;
  wob.connect(wobD);
  oscs.forEach((o) => wobD.connect(o.frequency));
  rate.start();
  wob.start();
  flutter.connect(out).connect(master!);
  purrNodes = {
    out,
    stop: () => [...oscs, rate, wob].forEach((o) => o.stop()),
  };
}
function purrOff() {
  if (!purrNodes || !ctx) return;
  const n = purrNodes;
  purrNodes = null;
  n.out.gain.cancelScheduledValues(ctx.currentTime);
  n.out.gain.setValueAtTime(n.out.gain.value, ctx.currentTime);
  n.out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
  setTimeout(n.stop, 300);
}

/* ---------------- ambient ---------------- */
type NoiseColor = 'white' | 'pink' | 'brown';
const buffers = new Map<NoiseColor, AudioBuffer>();
function noise(color: NoiseColor): AudioBuffer {
  const have = buffers.get(color);
  if (have) return have;
  const c = ac();
  const len = c.sampleRate * 4;
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'white') d[i] = w * 0.5;
      else if (color === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    // crossfade the loop seam
    const f = Math.floor(c.sampleRate * 0.05);
    for (let i = 0; i < f; i++) {
      const k = i / f;
      d[i] = d[i] * k + d[len - f + i] * (1 - k);
    }
  }
  buffers.set(color, b);
  return b;
}

interface Running {
  id: AmbientId;
  out: GainNode;
  stop: () => void;
}
let running: Running | null = null;
let ambVolume = 0.6;

function loop(color: NoiseColor, dest: AudioNode, filters: BiquadFilterNode[], gain: number) {
  const c = ac();
  const src = c.createBufferSource();
  src.buffer = noise(color);
  src.loop = true;
  src.loopStart = 0.05;
  src.playbackRate.value = 0.97 + Math.random() * 0.06;
  const g = c.createGain();
  g.gain.value = gain;
  let node: AudioNode = src;
  for (const f of filters) node = node.connect(f);
  node.connect(g).connect(dest);
  src.start();
  return { src, g };
}
function filt(type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = ac().createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}
function lfo(param: AudioParam, rate: number, depth: number) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.value = rate;
  g.gain.value = depth;
  o.connect(g).connect(param);
  o.start();
  return o;
}

/** Random one-shot events (drops, crackles, chirps, clinks) on a timer. */
function events(fn: (t: number) => void, minGap: number, maxGap: number) {
  let alive = true;
  let timer = 0;
  const next = () => {
    if (!alive) return;
    timer = window.setTimeout(() => {
      if (!alive || !ctx) return;
      fn(ctx.currentTime);
      next();
    }, (minGap + Math.random() * (maxGap - minGap)) * 1000);
  };
  next();
  return () => {
    alive = false;
    clearTimeout(timer);
  };
}

function blip(dest: AudioNode, freq: number, dur: number, gain: number, type: OscillatorType = 'sine', glide = 1) {
  const c = ac();
  const t0 = c.currentTime;
  const o = c.createOscillator();
  const v = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glide !== 1) o.frequency.exponentialRampToValueAtTime(freq * glide, t0 + dur);
  v.gain.setValueAtTime(0, t0);
  v.gain.linearRampToValueAtTime(gain, t0 + 0.004);
  v.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(v).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}
function crackle(dest: AudioNode, gain: number, hp: number) {
  const c = ac();
  const src = c.createBufferSource();
  src.buffer = noise('white');
  const f = filt('highpass', hp);
  const v = c.createGain();
  const t0 = c.currentTime;
  const dur = 0.01 + Math.random() * 0.03;
  v.gain.setValueAtTime(gain, t0);
  v.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(v).connect(dest);
  src.start(t0, Math.random() * 3);
  src.stop(t0 + dur + 0.02);
}

function build(id: AmbientId, out: GainNode): () => void {
  const stops: (() => void)[] = [];
  const srcs: AudioScheduledSourceNode[] = [];
  const add = (r: { src: AudioScheduledSourceNode }) => srcs.push(r.src);
  if (id === 'rain') {
    add(loop('pink', out, [filt('highpass', 400), filt('lowpass', 5200)], 0.55));
    add(loop('brown', out, [filt('lowpass', 300)], 0.35));
    stops.push(events(() => blip(out, 2200 + Math.random() * 2600, 0.04, 0.03 + Math.random() * 0.03, 'sine', 0.6), 0.03, 0.18));
  } else if (id === 'brown') {
    add(loop('brown', out, [filt('lowpass', 900)], 0.9));
  } else if (id === 'fire') {
    const r = loop('brown', out, [filt('lowpass', 420)], 0.7);
    add(r);
    srcs.push(lfo(r.g.gain, 0.23, 0.18));
    stops.push(events(() => crackle(out, 0.25 + Math.random() * 0.35, 1800 + Math.random() * 2500), 0.04, 0.5));
    stops.push(events(() => {
      for (let i = 0; i < 4; i++) setTimeout(() => crackle(out, 0.2, 2500), i * (20 + Math.random() * 40));
    }, 2, 6));
  } else if (id === 'forest') {
    const w = loop('pink', out, [filt('bandpass', 500, 0.6)], 0.35);
    add(w);
    srcs.push(lfo(w.g.gain, 0.08, 0.2));
    stops.push(events(() => {
      const f = 4300 + Math.random() * 500;
      for (let i = 0; i < 3; i++) setTimeout(() => blip(out, f, 0.05, 0.025, 'sine'), i * 70);
    }, 0.6, 2.2));
    stops.push(events(() => blip(out, 380 + Math.random() * 60, 0.5, 0.02, 'sine', 0.8), 6, 14));
  } else if (id === 'ocean') {
    const a = loop('pink', out, [filt('lowpass', 900)], 0.5);
    const b = loop('brown', out, [filt('lowpass', 400)], 0.5);
    add(a);
    add(b);
    srcs.push(lfo(a.g.gain, 0.09, 0.45));
    srcs.push(lfo(b.g.gain, 0.07, 0.3));
  } else if (id === 'cafe') {
    const m = loop('pink', out, [filt('bandpass', 420, 0.9), filt('lowpass', 1400)], 0.55);
    add(m);
    srcs.push(lfo(m.g.gain, 0.5, 0.12));
    add(loop('brown', out, [filt('lowpass', 250)], 0.3));
    stops.push(events(() => {
      const f = 2400 + Math.random() * 1600;
      blip(out, f, 0.35, 0.02, 'sine');
      blip(out, f * 1.48, 0.25, 0.01, 'sine');
    }, 2.5, 7));
  }
  return () => {
    stops.forEach((s) => s());
    srcs.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
  };
}

export function playAmbient(id: AmbientId) {
  if (running?.id === id) return;
  stopAmbient();
  if (id === 'off') return;
  const c = ac();
  const out = c.createGain();
  out.gain.value = 0;
  out.connect(master!);
  out.gain.linearRampToValueAtTime(ambVolume * 0.5, c.currentTime + 1.2);
  const stop = build(id, out);
  running = { id, out, stop };
}

export function stopAmbient() {
  if (!running || !ctx) return;
  const r = running;
  running = null;
  const t = ctx.currentTime;
  r.out.gain.cancelScheduledValues(t);
  r.out.gain.setValueAtTime(r.out.gain.value, t);
  r.out.gain.linearRampToValueAtTime(0, t + 0.6);
  setTimeout(() => {
    r.stop();
    r.out.disconnect();
  }, 700);
}

export function setAmbientVolume(v: number) {
  ambVolume = v;
  if (running && ctx) running.out.gain.setTargetAtTime(v * 0.5, ctx.currentTime, 0.1);
}

export function ambientPlaying(): AmbientId | null {
  return running?.id ?? null;
}
