/**
 * Auras: particles around a ghost, behind and in front of it. They never touch the ghost's art.
 *
 * AuraSim is the simulation (no DOM, testable). SvgAura draws it into two SVG groups, one behind and
 * one in front of the ghost; the rig and the small previews both use it. Coordinates are stage units
 * (the rig's 600 x 620 stage), around a centre that follows the floating ghost.
 */
import { rgbCss } from './shimmer';
import type { Rgb } from './shimmer';

export type Rng = () => number;
export type AuraMode = 'idle' | 'focus' | 'sleep';

/** Where the ghost is: centre and half size in stage units, plus its glow colour. */
export interface AuraBox {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  glow: Rgb;
}

export type Shape = 'fly' | 'spark' | 'bubble' | 'leaf' | 'snow' | 'petal' | 'star' | 'note' | 'arc' | 'comet' | 'dot';

export interface AuraParticle {
  shape: Shape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  rot: number;
  vr: number;
  back: boolean;
  /** Fill or stroke colour; null takes the glow colour. */
  color: string | null;
  /** Random phase for wobble and twinkle. */
  ph: number;
  /** Orbit angle and speed (stardust), or arc path (storm). */
  a: number;
  va: number;
  d: string;
  text: string;
}

interface AuraDef {
  /** New particles per second. */
  rate: number;
  max: number;
  spawn(r: Rng, b: AuraBox, p: AuraParticle): void;
  /** Extra motion on top of x += vx, y += vy. */
  move?(p: AuraParticle, dt: number, b: AuraBox): void;
  /** Opacity at life fraction k (0..1). */
  alpha?(p: AuraParticle, k: number): number;
  /** Scale at life fraction k. */
  scale?(p: AuraParticle, k: number): number;
  /** A second, independent stream (sparks around the storm ring, twinkles behind comets). */
  extra?: AuraDef;
}

const fade = (k: number, inn = 0.15, out = 0.25) => Math.min(1, k / inn, (1 - k) / out);
const pick = <T>(r: Rng, a: T[]) => a[Math.floor(r() * a.length) % a.length];
/** A point in a band around the ghost, not on it. */
function around(r: Rng, b: AuraBox, inner = 0.75, outer = 1.25): [number, number] {
  const a = r() * Math.PI * 2;
  const d = inner + (outer - inner) * Math.sqrt(r());
  return [b.cx + Math.cos(a) * b.rx * d, b.cy + Math.sin(a) * b.ry * d];
}

const TWINKLE: AuraDef = {
  rate: 2.6,
  max: 8,
  spawn(r, b, p) {
    p.shape = 'star';
    [p.x, p.y] = around(r, b, 0.9, 1.5);
    p.life = 1.4 + r() * 1.2;
    p.size = 3 + r() * 4;
    p.color = pick(r, ['#ffffff', '#fff3c4', '#cfe8ff']);
    p.back = true;
  },
  alpha: (_p, k) => fade(k, 0.3, 0.4),
  scale: (_p, k) => Math.sin(k * Math.PI),
};

export const AURAS: Record<string, AuraDef> = {
  aura_fireflies: {
    rate: 4.5,
    max: 16,
    spawn(r, b, p) {
      p.shape = 'fly';
      [p.x, p.y] = around(r, b, 0.55, 1.2);
      p.vx = (r() - 0.5) * 24;
      p.vy = (r() - 0.5) * 20 - 6;
      p.life = 3.5 + r() * 2.5;
      p.size = 5 + r() * 4;
      p.back = r() < 0.5;
    },
    move(p, dt) {
      p.x += Math.sin(p.age * 1.7 + p.ph) * 22 * dt;
      p.y += Math.cos(p.age * 1.3 + p.ph) * 16 * dt;
    },
    alpha: (p, k) => fade(k, 0.2, 0.3) * (0.45 + 0.55 * Math.max(0, Math.sin(p.age * 5 + p.ph))),
  },
  aura_sparks: {
    rate: 9,
    max: 22,
    spawn(r, b, p) {
      p.shape = 'spark';
      p.x = b.cx + (r() - 0.5) * b.rx * 2.1;
      p.y = b.cy + b.ry * (0.55 + r() * 0.4);
      p.vx = (r() - 0.5) * 16;
      p.vy = -90 - r() * 70;
      p.life = 1.1 + r() * 0.8;
      p.size = 6 + r() * 5;
      p.back = r() < 0.6;
    },
    move(p, dt) {
      p.x += Math.sin(p.age * 11 + p.ph) * 28 * dt;
    },
    alpha: (_p, k) => fade(k, 0.1, 0.5),
    scale: (_p, k) => 1 - k * 0.5,
  },
  aura_bubbles: {
    rate: 2.2,
    max: 10,
    spawn(r, b, p) {
      p.shape = 'bubble';
      p.x = b.cx + (r() - 0.5) * b.rx * 2.4;
      p.y = b.cy + b.ry * (0.4 + r() * 0.5);
      p.vy = -32 - r() * 22;
      p.life = 3 + r() * 1.6;
      p.size = 8 + r() * 9;
      p.back = r() < 0.45;
    },
    move(p, dt) {
      p.x += Math.sin(p.age * 2.2 + p.ph) * 18 * dt;
    },
    // a bubble pops at the end: it swells and vanishes quickly
    alpha: (_p, k) => (k > 0.92 ? (1 - k) / 0.08 : fade(k, 0.12, 0.05)),
    scale: (_p, k) => (k > 0.92 ? 1 + (k - 0.92) * 5 : 0.7 + Math.min(1, k * 4) * 0.3),
  },
  aura_leaves: {
    rate: 2.2,
    max: 12,
    spawn(r, b, p) {
      p.shape = 'leaf';
      p.x = b.cx + (r() - 0.5) * b.rx * 2.8;
      p.y = b.cy - b.ry * (1.05 + r() * 0.3);
      p.vy = 38 + r() * 22;
      p.life = 4.2 + r() * 1.4;
      p.size = 9 + r() * 4;
      p.rot = r() * 360;
      p.color = pick(r, ['#ff9a3c', '#ffcd4a', '#e8603b', '#d1842f']);
      p.back = r() < 0.5;
    },
    move(p, dt) {
      const sw = Math.sin(p.age * 2 + p.ph);
      p.x += sw * 46 * dt;
      p.rot = sw * 50 + p.ph * 57;
    },
    alpha: (_p, k) => fade(k, 0.1, 0.2),
  },
  aura_snow: {
    rate: 4,
    max: 22,
    spawn(r, b, p) {
      p.shape = 'snow';
      p.x = b.cx + (r() - 0.5) * b.rx * 3;
      p.y = b.cy - b.ry * (1 + r() * 0.35);
      p.vy = 36 + r() * 26;
      p.life = 5 + r() * 2.5;
      p.size = 4 + r() * 5;
      p.vr = (r() - 0.5) * 60;
      p.back = r() < 0.5;
    },
    move(p, dt) {
      p.x += Math.sin(p.age * 1.2 + p.ph) * 14 * dt;
    },
    alpha: (_p, k) => fade(k, 0.1, 0.2) * 0.95,
  },
  aura_blossoms: {
    rate: 3,
    max: 16,
    spawn(r, b, p) {
      p.shape = 'petal';
      p.x = b.cx - b.rx * (0.4 + r() * 1.4);
      p.y = b.cy - b.ry * (0.6 + r() * 0.7);
      p.vx = 26 + r() * 22;
      p.vy = 24 + r() * 18;
      p.life = 4.5 + r() * 1.5;
      p.size = 6 + r() * 4;
      p.rot = r() * 360;
      p.vr = (r() < 0.5 ? -1 : 1) * (60 + r() * 90);
      p.color = pick(r, ['#ffc4de', '#ffa6cd', '#fff0f6']);
      p.back = r() < 0.5;
    },
    move(p, dt) {
      p.y += Math.sin(p.age * 2.6 + p.ph) * 14 * dt;
    },
    alpha: (_p, k) => fade(k, 0.1, 0.2),
  },
  aura_stardust: {
    rate: 7,
    max: 24,
    spawn(r, _b, p) {
      p.shape = 'star';
      p.a = r() * Math.PI * 2;
      p.va = 0.45 + r() * 0.35;
      p.ph = 1.02 + r() * 0.22; // orbit radius factor
      p.life = 2.2 + r() * 1.6;
      p.size = 3.5 + r() * 4.5;
      p.color = r() < 0.34 ? null : pick(r, ['#ffffff', '#fff1b8']);
    },
    move(p, dt, b) {
      p.a += p.va * dt;
      p.x = b.cx + Math.cos(p.a) * b.rx * p.ph * 1.08;
      p.y = b.cy + 10 + Math.sin(p.a) * b.ry * 0.36 * p.ph;
      p.back = Math.sin(p.a) < 0;
    },
    alpha: (_p, k) => fade(k, 0.2, 0.3),
    scale: (p) => 0.75 + 0.35 * Math.sin(p.age * 7 + p.va * 20),
  },
  aura_notes: {
    rate: 1.5,
    max: 8,
    spawn(r, b, p) {
      p.shape = 'note';
      const side = r() < 0.5 ? -1 : 1;
      p.x = b.cx + side * b.rx * (0.9 + r() * 0.3);
      p.y = b.cy + b.ry * (r() * 0.4);
      p.vx = side * (6 + r() * 8);
      p.vy = -42 - r() * 18;
      p.life = 2.6 + r() * 0.8;
      p.size = 1;
      p.color = pick(r, ['#ff8fc7', '#8fd3ff', '#ffd56b', '#a6f28a', '#c59bff']);
      p.text = pick(r, ['♪', '♫']);
      p.back = r() < 0.35;
    },
    move(p, dt) {
      p.x += Math.sin(p.age * 3 + p.ph) * 24 * dt;
      p.rot = Math.sin(p.age * 3 + p.ph) * 14;
    },
    alpha: (_p, k) => fade(k, 0.12, 0.3),
    scale: (_p, k) => 0.6 + Math.min(1, k * 5) * 0.4,
  },
  aura_storm: {
    rate: 6,
    max: 10,
    spawn(r, b, p) {
      p.shape = 'arc';
      const a0 = r() * Math.PI * 2,
        span = 0.35 + r() * 0.35;
      const n = 7;
      let d = '';
      for (let i = 0; i <= n; i++) {
        const a = a0 + (span * i) / n;
        const j = i === 0 || i === n ? 0 : (r() - 0.5) * 22;
        const x = Math.cos(a) * (b.rx * 1.08 + j),
          y = Math.sin(a) * (b.ry * 0.95 + j);
        d += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      }
      p.d = d;
      p.x = b.cx;
      p.y = b.cy + 10;
      p.life = 0.22 + r() * 0.24;
      p.size = 1;
      p.back = Math.sin(a0 + span / 2) < 0.1;
    },
    move(p, _dt, b) {
      p.x = b.cx;
      p.y = b.cy + 10;
    },
    alpha: (p) => 0.55 + 0.45 * Math.abs(Math.sin(p.age * 70 + p.ph)),
    extra: {
      rate: 11,
      max: 20,
      spawn(r, b, p) {
        p.shape = 'spark';
        const a = r() * Math.PI * 2;
        p.x = b.cx + Math.cos(a) * b.rx * 1.08;
        p.y = b.cy + 10 + Math.sin(a) * b.ry * 0.95;
        p.vx = Math.cos(a) * (60 + r() * 80);
        p.vy = Math.sin(a) * (60 + r() * 80);
        p.life = 0.35 + r() * 0.3;
        p.size = 5 + r() * 4;
        p.back = Math.sin(a) < 0.1;
      },
      alpha: (_p, k) => 1 - k,
    },
  },
  aura_comets: {
    rate: 1.5,
    max: 4,
    spawn(r, b, p) {
      p.shape = 'comet';
      p.x = b.cx - b.rx * (1.2 + r() * 0.8);
      p.y = b.cy - b.ry * (1.1 + r() * 0.5);
      const sp = 300 + r() * 120,
        dir = (22 + r() * 18) * (Math.PI / 180);
      p.vx = Math.cos(dir) * sp;
      p.vy = Math.sin(dir) * sp;
      p.rot = (dir * 180) / Math.PI;
      p.life = 1.3;
      p.size = 1.3 + r() * 0.6;
      p.back = true;
    },
    alpha: (_p, k) => fade(k, 0.1, 0.35),
    extra: TWINKLE,
  },
};

const blank = (): AuraParticle => ({
  shape: 'dot',
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  age: 0,
  life: 1,
  size: 1,
  rot: 0,
  vr: 0,
  back: false,
  color: null,
  ph: 0,
  a: 0,
  va: 0,
  d: '',
  text: '',
});

/** Rate and look factors by mode: calmer while focusing, dim and slow while asleep. */
const MODE = { idle: { rate: 1, alpha: 1 }, focus: { rate: 0.6, alpha: 0.9 }, sleep: { rate: 0.5, alpha: 0.75 } };

export interface Live extends AuraParticle {
  def: AuraDef;
  alpha: number;
  scale: number;
  /** Renderer handle. */
  el?: SVGElement;
}

export class AuraSim {
  particles: Live[] = [];
  private acc: number[] = [0, 0];
  private def: AuraDef | null = null;
  private rng: Rng;
  private reduce: boolean;
  constructor(id: string | undefined, rng: Rng = Math.random, reduce = false) {
    this.rng = rng;
    this.reduce = reduce;
    this.setId(id);
  }
  setId(id: string | undefined) {
    const next = id ? (AURAS[id] ?? null) : null;
    // the old aura fades out quickly instead of lingering for its full life
    if (next !== this.def) for (const p of this.particles) if (p.def !== next && p.def !== next?.extra) p.age = Math.max(p.age, p.life - 0.35);
    this.def = next;
    this.acc = [0, 0];
  }
  get active() {
    return !!this.def || this.particles.length > 0;
  }
  private add(def: AuraDef, b: AuraBox) {
    const p = blank() as Live;
    p.ph = this.rng() * Math.PI * 2;
    def.spawn(this.rng, b, p);
    if (this.reduce) {
      p.vx *= 0.5;
      p.vy *= 0.5;
      p.va *= 0.5;
      p.life *= 1.5;
    }
    p.def = def;
    p.alpha = 0;
    p.scale = 1;
    this.particles.push(p);
  }
  /** A short burst, for cheers. */
  burst(b: AuraBox, n = 8) {
    if (!this.def) return;
    for (let i = 0; i < n; i++) if (this.count(this.def) < this.def.max + 6) this.add(this.def, b);
  }
  private count(def: AuraDef) {
    let n = 0;
    for (const p of this.particles) if (p.def === def) n++;
    return n;
  }
  step(dt: number, b: AuraBox, mode: AuraMode = 'idle') {
    const m = MODE[mode];
    const defs = this.def ? [this.def, this.def.extra].filter((d): d is AuraDef => !!d) : [];
    defs.forEach((def, i) => {
      this.acc[i] += dt * def.rate * m.rate * (this.reduce ? 0.4 : 1);
      while (this.acc[i] >= 1) {
        this.acc[i] -= 1;
        if (this.count(def) < def.max) this.add(def, b);
      }
    });
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(i, 1);
        p.el?.remove();
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.def.move?.(p, dt, b);
      const k = p.age / p.life;
      p.alpha = (p.def.alpha?.(p, k) ?? fade(k)) * m.alpha;
      p.scale = p.def.scale?.(p, k) ?? 1;
    }
  }
  clear() {
    for (const p of this.particles) p.el?.remove();
    this.particles = [];
  }
}

/* ---------- SVG renderer ---------- */
const NS = 'http://www.w3.org/2000/svg';
const LEAF = 'M0,-10 C7,-6 7,5 0,10 C-7,5 -7,-6 0,-10 Z M0,-7 L0,8';
const PETAL = 'M0,9 C-8,3 -6,-7 -2,-9 L0,-6 L2,-9 C6,-7 8,3 0,9 Z';
const SNOW = 'M0,-9 L0,9 M-7.8,-4.5 L7.8,4.5 M-7.8,4.5 L7.8,-4.5 M-2.5,-7 L0,-5 L2.5,-7 M-2.5,7 L0,5 L2.5,7';
const STAR = 'M0,-12 C2,-3 3,-2 12,0 C3,2 2,3 0,12 C-2,3 -3,2 -12,0 C-3,-2 -2,-3 0,-12 Z';
/** The path shapes are drawn about 10 units wide; this brings them to a common scale with the circles (a path reads about twice a circle's radius). */
const UNIT: Partial<Record<Shape, number>> = { leaf: 1 / 5, petal: 1 / 4.5, snow: 1 / 5, star: 1 / 7 };
const OUTLINE = '#0e2533';
let svgUid = 0;

export class SvgAura {
  private id = `aura${++svgUid}`;
  private glowCss = '#ffffff';
  private stops: SVGStopElement[] = [];
  private back: SVGGElement;
  private front: SVGGElement;
  /** Draws every particle this much larger (small previews need it to stay readable). */
  private boost: number;
  constructor(back: SVGGElement, front: SVGGElement, boost = 1) {
    this.back = back;
    this.front = front;
    this.boost = boost;
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `
      <radialGradient id="${this.id}fly"><stop offset="0" stop-color="#fffbe0"/><stop offset="0.3" stop-color="#f2ff8a" stop-opacity="0.9"/><stop offset="1" stop-color="#c8ff5a" stop-opacity="0"/></radialGradient>
      <radialGradient id="${this.id}spark"><stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="#ffffff" stop-opacity="0.85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="${this.id}tail" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="0.25" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
    back.appendChild(defs);
    this.stops = [...defs.querySelectorAll(`#${this.id}spark stop:not(:first-child), #${this.id}tail stop:not(:first-child)`)] as SVGStopElement[];
  }
  setGlow(c: Rgb) {
    const css = rgbCss(c);
    if (css === this.glowCss) return;
    this.glowCss = css;
    for (const s of this.stops) s.setAttribute('stop-color', css);
  }
  private make(p: Live): SVGElement {
    const c = p.color ?? this.glowCss;
    let e: SVGElement;
    const path = (d: string, attrs: Record<string, string>) => {
      const x = document.createElementNS(NS, 'path');
      x.setAttribute('d', d);
      for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, v);
      return x;
    };
    switch (p.shape) {
      case 'fly':
        e = document.createElementNS(NS, 'circle');
        e.setAttribute('r', '1');
        e.setAttribute('fill', `url(#${this.id}fly)`);
        break;
      case 'spark':
        e = document.createElementNS(NS, 'circle');
        e.setAttribute('r', '1');
        e.setAttribute('fill', `url(#${this.id}spark)`);
        break;
      case 'bubble': {
        e = document.createElementNS(NS, 'g');
        e.innerHTML = `<circle r="1" fill="rgba(190,240,255,0.16)" stroke="#d9f6ff" stroke-width="1.6" vector-effect="non-scaling-stroke"/><ellipse cx="-0.35" cy="-0.4" rx="0.28" ry="0.16" fill="#ffffff" opacity="0.8" transform="rotate(-35 -0.35 -0.4)"/>`;
        break;
      }
      case 'leaf':
        e = path(LEAF, { fill: c, stroke: OUTLINE, 'stroke-width': '1.6', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' });
        break;
      case 'petal':
        e = path(PETAL, { fill: c, stroke: OUTLINE, 'stroke-width': '1.3', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' });
        break;
      case 'snow':
        e = path(SNOW, { fill: 'none', stroke: '#f4fbff', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' });
        break;
      case 'star':
        e = path(STAR, { fill: c });
        break;
      case 'note': {
        e = document.createElementNS(NS, 'text');
        e.textContent = p.text;
        e.setAttribute('font-size', '30');
        e.setAttribute('font-weight', '700');
        e.setAttribute('text-anchor', 'middle');
        e.setAttribute('dominant-baseline', 'central');
        e.setAttribute('fill', c);
        e.setAttribute('stroke', OUTLINE);
        e.setAttribute('stroke-width', '2.4');
        e.setAttribute('paint-order', 'stroke');
        break;
      }
      case 'arc': {
        e = document.createElementNS(NS, 'g');
        e.innerHTML = `<path d="${p.d}" fill="none" stroke="${this.glowCss}" stroke-opacity="0.45" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="${p.d}" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
        break;
      }
      case 'comet': {
        e = document.createElementNS(NS, 'g');
        e.innerHTML = `<path d="M2,-3.5 L-90,0 L2,3.5 Z" fill="url(#${this.id}tail)"/><path d="${STAR}" fill="#ffffff" transform="scale(0.55)"/>`;
        break;
      }
      default:
        e = document.createElementNS(NS, 'circle');
        e.setAttribute('r', '1');
        e.setAttribute('fill', c);
    }
    return e;
  }
  /** Brings the SVG in line with the simulation. With allBack every particle stays behind the ghost. */
  sync(sim: AuraSim, allBack = false) {
    for (const p of sim.particles) {
      const want = allBack || p.back ? this.back : this.front;
      if (!p.el) {
        p.el = this.make(p);
        want.appendChild(p.el);
      } else if (p.el.parentNode !== want) want.appendChild(p.el);
      const s = Math.max(0.01, p.size * p.scale * (UNIT[p.shape] ?? 1) * this.boost);
      const t = p.shape === 'arc' ? `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})` : `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${p.rot.toFixed(1)}) scale(${s.toFixed(3)})`;
      p.el.setAttribute('transform', t);
      p.el.setAttribute('opacity', Math.max(0, Math.min(1, p.alpha)).toFixed(3));
    }
  }
}
