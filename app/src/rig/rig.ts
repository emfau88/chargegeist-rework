/**
 * The ghost rig: a ghost assembled from the parts of its kit, always exactly as the kit shows it.
 * The body lies on a deformable mesh (WebGL2), face parts are painted onto that mesh, arms and tuft
 * hang on hinges. Every soft motion runs through a spring. Falls back to a flat 2D canvas when WebGL2
 * is unavailable. Style shows around the ghost and never changes its shape: an aura (particles
 * behind and in front), a shimmer (the colour of glow, charge fill, charge ring and sparks) and a
 * charm (a small keepsake floating beside the ghost, on the side away from the waving arm).
 *
 * Each ghost has its own body space (pixels of its body texture). RigConfig maps it to the stage
 * (600 x 620 units): k scales it, (cx, cy) lands on (300, 280). Motion constants were tuned on
 * Volti and are scaled by m (body motion) and u (face motion) for the others.
 */
import { charmImg, ghost, partUrl } from '../data/catalog';
import { CHARMS } from '../data/charms.gen';
import { EYES } from '../data/eyes.gen';
import { ACT_SECONDS, CHARM_PUSH_AT, IDLE_ACTS, PROUD_SPARKLE_AT, actGap, actPose, eagerActs, mayAct, onPlayAct, pickAct } from './acts';
import type { ActName } from './acts';
import { GLINT_FOLLOW, eyePose, lids, pupilShift } from './gaze';
import { GestureTracker } from './gestures';
import type { Gesture } from './gestures';
import { RIGS } from '../data/rigs.gen';
import type { ArmRig, Limb, RigConfig, Vec } from '../data/rigTypes';
import { AuraSim, SvgAura } from '../fx/aura';
import type { AuraBox } from '../fx/aura';
import { NEUTRAL_LIGHT, lightOn, sceneLight } from '../fx/light';
import type { SceneLight } from '../logic/sky';
import { rgbCss, shimmerMoves, shimmerRgb } from '../fx/shimmer';

export type RigMode = 'idle' | 'focus' | 'sleep';

/** The style a ghost shows. */
export interface RigStyle {
  aura?: string;
  shimmer?: string;
  charm?: string;
}
export interface Look {
  ghost: string;
  style?: RigStyle;
}

export interface RigOptions {
  /** React to pointer and taps. */
  interactive?: boolean;
  /** >1 shows the ghost bigger in the same box. */
  zoom?: number;
  /** Extra drawing room around the box, as fractions of its height, so jumps and particles are not clipped. */
  overscan?: { top: number; side: number; bottom: number };
  /** Vertical offset of the ghost centre in stage units (positive moves it down). */
  shiftY?: number;
  showShadow?: boolean;
  onPoke?: () => void;
  /** Every gesture on the ghost (tap, tickle, hold, stroke), for sound, vibration and hearts. */
  onGesture?: (g: Gesture) => void;
  /** A touch woke him up (tap, tickle, hold or a celebration); stroking keeps him asleep. */
  onWake?: () => void;
  /** He hugs you (bond stage Friend and up, after a long stroke). */
  onHug?: () => void;
  /** His little acts at rest (see acts.ts). Off on the focus and break screens, where he stays calm. */
  idleActs?: boolean;
  /** It is late: now and then he yawns. */
  tired?: boolean;
}

export interface RigApi {
  setMode(m: RigMode): void;
  setLevel(v: number, instant?: boolean): void;
  setRing(p: number | null): void;
  setLook(l: Look): void;
  celebrate(big?: boolean): void;
  poke(): void;
  wave(): void;
  /** Waves hello with a little hop (from the Familiar bond stage). */
  greet(): void;
  /** Looks at a point of the screen for a moment (client coordinates), unless something holds his eyes already. */
  glance(clientX: number, clientY: number, seconds?: number): void;
  /** A reaction (a nod, pride): it starts as soon as he is free. */
  act(name: ActName): void;
  /** The bond stage with this ghost (0..4): 2 hugs after a long stroke, 3 turns holding into a high five. */
  setBond(level: number): void;
  /** Where his shadow lies on the screen right now (pixels from the top of the window). */
  groundY(): number;
  destroy(): void;
  ready: Promise<void>;
}

const NS = 'http://www.w3.org/2000/svg';
const RAD = Math.PI / 180;
/**
 * The light of the scene on a ghost: a slight tint in the colour of the hour, and a hem that lets a
 * little of the scene through. Nothing is drawn outside the figure's own outline.
 * SHEER: how much of the scene shows through the skin at the very hem.
 */
const SHEER = 0.18;
/** The lids over one layer of an eye: where they are (see gaze.ts), the width of the lid line and where the layer lies in the eye, all as shares of the eye part. */
interface Lid {
  top: number;
  bot: number;
  bow: number;
  line: number;
  ox: number;
  oy: number;
}
/** Where the ground shadow lies in the 600-unit stage: close under the ghost, so it reads as its own. */
const SHADOW_Y = 500;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/**
 * How far an arm is turned. A loose arm turns as far as asked. One that was cut out of the finished figure
 * hangs where it was painted: it takes a share of the turn and keeps within its limits.
 */
function armTurn(a: ArmRig, deg: number, left: boolean): number {
  if (a.gain === undefined) return deg;
  // a positive turn raises the left arm and lowers the right one
  const rise = clamp((left ? deg : -deg) * a.gain, -(a.down ?? 0), a.up ?? 180);
  return left ? rise : -rise;
}
const smooth = (a: number, b: number, v: number) => {
  const x = clamp((v - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
/** Whether a point lies inside an outline given as x and y of each corner in turn. */
function inShape(shape: number[], x: number, y: number): boolean {
  let inside = false;
  for (let a = 0, b = shape.length - 2; a < shape.length; b = a, a += 2) {
    const ax = shape[a],
      ay = shape[a + 1],
      bx = shape[b],
      by = shape[b + 1];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
/** How far a point is from an outline (from its nearest edge). */
function toShape(shape: number[], x: number, y: number): number {
  let best = Infinity;
  for (let a = 0, b = shape.length - 2; a < shape.length; b = a, a += 2) {
    const ex = shape[a] - shape[b],
      ey = shape[a + 1] - shape[b + 1];
    const t = Math.max(0, Math.min(1, ((x - shape[b]) * ex + (y - shape[b + 1]) * ey) / (ex * ex + ey * ey || 1)));
    best = Math.min(best, Math.hypot(x - shape[b] - t * ex, y - shape[b + 1] - t * ey));
  }
  return best;
}
const rot = (deg: number, x: number, y: number): Vec => {
  const c = Math.cos(deg * RAD),
    s = Math.sin(deg * RAD);
  return [x * c - y * s, x * s + y * c];
};

class Spring {
  x: number;
  v = 0;
  t: number;
  k: number;
  d: number;
  constructor(x: number, k: number, d: number) {
    this.x = x;
    this.t = x;
    this.k = k;
    this.d = d;
  }
  step(h: number) {
    const a = (this.t - this.x) * this.k - this.v * this.d;
    this.v += a * h;
    this.x += this.v * h;
  }
}

/* ---------- parts and images ---------- */
const FACE_PARTS = [
  'body',
  'eye_open_L',
  'eye_open_R',
  'eye_happy_L',
  'eye_happy_R',
  'eye_sleep_L',
  'eye_sleep_R',
  'mouth_smile',
  'mouth_laugh',
  'mouth_o',
  'mouth_line',
  'blush_L',
  'blush_R',
  'arm_L',
  'arm_R',
];
/** The layers of an open eye, from back to front (see tools/split_eyes.py). Only the live rig draws them; a still portrait takes the flat eye. */
const EYE_LAYERS = ['back', 'iris', 'ring', 'glint'];
export function partNames(id: string, live = false): string[] {
  const baked = RIGS[id].baked ?? [];
  const own = FACE_PARTS.filter((p) => !(baked.includes('arms') && p.startsWith('arm_')) && !(baked.includes('blush') && p.startsWith('blush_')));
  const parts = RIGS[id].tuft ? [...own, 'tuft'] : own;
  if (!live || !EYES[id]) return parts;
  return [...parts, ...['L', 'R'].filter((side) => RIGS[id].eyes.includes(side)).flatMap((side) => EYE_LAYERS.map((n) => `eye_${n}_${side}`))];
}

const imgCache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = imgCache.get(url);
  if (!p) {
    p = new Promise((res, rej) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => res(im);
      im.onerror = () => rej(new Error(url));
      im.src = url;
    });
    imgCache.set(url, p);
  }
  return p;
}
export async function preloadLook(l: Pick<Look, 'ghost'>, live = false) {
  const parts = partNames(l.ghost, live);
  const p = await Promise.all(parts.map((n) => loadImage(partUrl(l.ghost, n))));
  const map: Record<string, HTMLImageElement> = {};
  parts.forEach((n, k) => (map[n] = p[k]));
  return map;
}

const HEART = 'M0,7 C-13,-3 -11,-14 -4.5,-14 C-1.5,-14 0,-11.5 0,-9.5 C0,-11.5 1.5,-14 4.5,-14 C11,-14 13,-3 0,7 Z';
const STAR = 'M0,-12 C2,-3 3,-2 12,0 C3,2 2,3 0,12 C-2,3 -3,2 -12,0 C-3,-2 -2,-3 0,-12 Z';
let uid = 0;

interface Tex {
  w: number;
  h: number;
  img: HTMLImageElement;
  t?: WebGLTexture;
}
interface Particle {
  el: SVGElement;
  kind: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  rot: number;
  vr: number;
  g: number;
}

export function createRig(host: HTMLElement, look: Look, opts: RigOptions = {}): RigApi {
  const id = `rig${++uid}`;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const zoom = opts.zoom ?? 1;
  const over = opts.overscan ?? { top: 0, side: 0, bottom: 0 };
  const shiftY = opts.shiftY ?? 0;
  let R: RigConfig = RIGS[look.ghost];
  let cur: Look = look;
  let shimmer = look.style?.shimmer;
  let glowRgb = shimmerRgb(shimmer, ghost(look.ghost).glow, 0);
  const glow0 = rgbCss(glowRgb);
  let alive = true;

  /* ---------- DOM ---------- */
  const layer = document.createElement('div');
  layer.className = 'rig-layer';
  layer.style.cssText = 'position:absolute;pointer-events:none;';
  // touch-action sits on the front svg itself: Chrome ignores it on SVG shapes like the hit ellipse.
  // pan-y lets a vertical swipe scroll the page while a sideways one strokes the ghost.
  layer.innerHTML = `
  <svg class="rig-back" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible" aria-hidden="true">
    <defs>
      <radialGradient id="${id}glow"><stop offset="0" stop-color="${glow0}" stop-opacity="0.5"/><stop offset="0.5" stop-color="${glow0}" stop-opacity="0.12"/><stop offset="1" stop-color="${glow0}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}tuft"><stop offset="0" stop-color="#f4ffb0" stop-opacity="0.85"/><stop offset="0.45" stop-color="#9ff6ff" stop-opacity="0.3"/><stop offset="1" stop-color="${glow0}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}spark"><stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="#e4fbff" stop-opacity="0.9"/><stop offset="1" stop-color="${glow0}" stop-opacity="0"/></radialGradient>
      <filter id="${id}blur" x="-60%" y="-200%" width="220%" height="500%"><feGaussianBlur stdDeviation="9"/></filter>
    </defs>
    <circle data-k="glow" cx="300" cy="300" r="270" fill="url(#${id}glow)" opacity="0.3"/>
    <g data-k="ring" opacity="0" transform="rotate(-90 300 300)">
      <circle cx="300" cy="300" r="205" fill="none" stroke="${glow0}" stroke-opacity="0.2" stroke-width="11"/>
      <circle data-k="ringFill" cx="300" cy="300" r="205" fill="none" stroke="${glow0}" stroke-width="11" stroke-linecap="round" stroke-dasharray="1288.05" stroke-dashoffset="1288.05"/>
      <g data-k="ringHead" opacity="0">
        <ellipse data-k="ringHalo" rx="22" ry="22" fill="${glow0}" opacity="0.75" filter="url(#${id}blur)"/>
        <ellipse rx="8.5" ry="8.5" fill="#ffffff"/>
      </g>
    </g>
    <circle data-k="tuftGlow" cx="300" cy="120" r="70" fill="url(#${id}tuft)" opacity="0"/>
    <g data-k="pBack"></g>
    <ellipse data-k="shadow" cx="300" cy="${SHADOW_Y}" rx="112" ry="15" fill="#03020a" opacity="0.55" filter="url(#${id}blur)"/>
  </svg>
  <canvas class="rig-gl" style="position:absolute;inset:0;width:100%;height:100%;display:block" aria-hidden="true"></canvas>
  <svg class="rig-front" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;touch-action:pan-y pinch-zoom" aria-hidden="true">
    <ellipse data-k="hit" cx="300" cy="300" rx="150" ry="172" fill="transparent" style="pointer-events:${opts.interactive ? 'auto' : 'none'};cursor:pointer"/>
    <g data-k="pFront" pointer-events="none"></g>
  </svg>`;
  host.appendChild(layer);
  const q = <T extends Element>(k: string) => layer.querySelector(`[data-k="${k}"]`) as T;
  const back = layer.querySelector('.rig-back') as SVGSVGElement;
  const front = layer.querySelector('.rig-front') as SVGSVGElement;
  let canvas = layer.querySelector('.rig-gl') as HTMLCanvasElement;
  const el = {
    glow: q<SVGCircleElement>('glow'),
    ring: q<SVGGElement>('ring'),
    ringFill: q<SVGCircleElement>('ringFill'),
    ringHead: q<SVGGElement>('ringHead'),
    tuftGlow: q<SVGCircleElement>('tuftGlow'),
    shadow: q<SVGEllipseElement>('shadow'),
    hit: q<SVGEllipseElement>('hit'),
    pBack: q<SVGGElement>('pBack'),
    pFront: q<SVGGElement>('pFront'),
  };
  if (opts.showShadow === false) el.shadow.style.display = 'none';

  /* ---------- view ---------- */
  const view = { x: 0, y: 0, w: 600, h: 620 };
  const layerBox = { left: 0, top: 0, w: 1, h: 1 };
  function layout() {
    const W = Math.max(1, host.clientWidth),
      H = Math.max(1, host.clientHeight);
    const mw = 440 / zoom,
      mh = 620 / zoom;
    let vw: number, vh: number;
    if (W / H >= mw / mh) {
      vh = mh;
      vw = (mh * W) / H;
    } else {
      vw = mw;
      vh = (mw * H) / W;
    }
    const upp = vw / W;
    const ox = over.side * H,
      ot = over.top * H,
      ob = over.bottom * H;
    layerBox.left = -ox;
    layerBox.top = -ot;
    layerBox.w = W + 2 * ox;
    layerBox.h = H + ot + ob;
    layer.style.left = `${-ox}px`;
    layer.style.top = `${-ot}px`;
    layer.style.width = `${layerBox.w}px`;
    layer.style.height = `${layerBox.h}px`;
    view.x = 300 - vw / 2 - ox * upp;
    view.y = 310 - vh / 2 - ot * upp;
    view.w = layerBox.w * upp;
    view.h = layerBox.h * upp;
    const vb = `${view.x.toFixed(2)} ${view.y.toFixed(2)} ${view.w.toFixed(2)} ${view.h.toFixed(2)}`;
    back.setAttribute('viewBox', vb);
    front.setAttribute('viewBox', vb);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(layerBox.w * dpr);
    canvas.height = Math.round(layerBox.h * dpr);
  }

  /* ---------- renderer ---------- */
  let gl: WebGL2RenderingContext | null = null;
  let ctx2d: CanvasRenderingContext2D | null = null;
  const loc: Record<string, WebGLUniformLocation | null> = {};
  const ibos = new Map<string, WebGLBuffer>();
  let TEX: Record<string, Tex> = {};
  const VERTS = new Float32Array(4 * 61 * 69);

  function initGL() {
    const g = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: true, alpha: true });
    if (!g) throw new Error('no webgl2');
    gl = g;
    const vs = `#version 300 es
in vec2 aPos; in vec2 aUV; uniform vec4 uView; out vec2 vUV;
void main(){ vUV = aUV; gl_Position = vec4((aPos.x - uView.x) * uView.z - 1.0, 1.0 - (aPos.y - uView.y) * uView.w, 0.0, 1.0); }`;
    const fs = `#version 300 es
precision mediump float;
in vec2 vUV; uniform sampler2D uTex; uniform float uAlpha, uLevel, uTime, uGlow, uDim, uBoost; uniform vec3 uFill;
// the light of the scene: uTint is laid over the figure; uSheer is how much the skin lets through at the hem
// (0: nothing), uHem where the hem starts and how long it is
uniform float uSheer; uniform vec2 uHem; uniform vec3 uTint;
// the lids of an eye. uLid: x upper edge, y lower edge (share of the eye's height), z how far the edges bow towards the
// corners, w width of the lid line (0: no lids). uLidOff: where this layer lies in the eye. uInk: colour of the lid line
uniform vec4 uLid; uniform vec2 uLidOff; uniform vec3 uInk; out vec4 outColor;
void main(){
  vec4 c = texture(uTex, vUV);
  vec3 rgb = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
  float a = c.a;
  float skin = smoothstep(0.30, 0.50, dot(rgb, vec3(0.3, 0.55, 0.15)));
  if (uLevel > 0.001) {
    float line = 1.0 - uLevel * 1.03 + sin(vUV.x * 14.0 + uTime * 3.2) * 0.012 + sin(vUV.x * 27.0 - uTime * 2.1) * 0.006;
    float fill = smoothstep(line - 0.004, line + 0.004, vUV.y);
    float crest = exp(-pow((vUV.y - line) / (0.012 + 0.008 * uBoost), 2.0));
    // uBoost (focus): the charge shows as light, brightest under the line, softer towards the foot, slowly breathing
    float depth = clamp((vUV.y - line) / 0.45, 0.0, 1.0);
    float body = fill * (0.36 + uBoost * (mix(0.30, 0.06, depth) + 0.04 * sin(uTime * 1.4)));
    vec3 fc = mix(uFill, vec3(1.0), 0.45);
    rgb = mix(rgb, fc, skin * clamp(body + crest * (0.6 + 0.25 * uBoost), 0.0, 1.0));
  }
  rgb += skin * uGlow * (uFill * 0.17 + 0.03);
  rgb *= uTint;
  if (uSheer > 0.0) {
    // the skin lets a little of the scene through towards the hem; outlines stay solid
    float hem = clamp((vUV.y - uHem.x) / uHem.y, 0.0, 1.0);
    a *= 1.0 - uSheer * hem * hem * skin;
  }
  if (uLid.w > 0.0) {
    // behind the lids the eye is gone and the skin of the body shows; a line of ink runs along each lid
    vec2 p = vUV + uLidOff;
    float q = 2.0 * p.x - 1.0;
    float bow = uLid.z * q * q;
    float near = min(p.y - uLid.x - bow, uLid.y + bow - p.y);
    rgb = mix(rgb, uInk, 1.0 - smoothstep(uLid.w * 0.55, uLid.w, near));
    a *= smoothstep(-0.012, 0.012, near);
  }
  rgb *= 1.0 - uDim * vec3(0.20, 0.14, 0.06);
  outColor = vec4(rgb * a, a) * uAlpha;
}`;
    const sh = (type: number, src: string) => {
      const s = g.createShader(type)!;
      g.shaderSource(s, src);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const prog = g.createProgram()!;
    g.attachShader(prog, sh(g.VERTEX_SHADER, vs));
    g.attachShader(prog, sh(g.FRAGMENT_SHADER, fs));
    g.linkProgram(prog);
    if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(prog) ?? 'link');
    g.useProgram(prog);
    for (const n of ['uView', 'uTex', 'uAlpha', 'uLevel', 'uTime', 'uGlow', 'uDim', 'uBoost', 'uFill', 'uSheer', 'uHem', 'uTint', 'uLid', 'uLidOff', 'uInk']) loc[n] = g.getUniformLocation(prog, n);
    g.bindVertexArray(g.createVertexArray());
    const vbo = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, vbo);
    g.bufferData(g.ARRAY_BUFFER, VERTS.byteLength, g.DYNAMIC_DRAW);
    const aPos = g.getAttribLocation(prog, 'aPos'),
      aUV = g.getAttribLocation(prog, 'aUV');
    g.enableVertexAttribArray(aPos);
    g.vertexAttribPointer(aPos, 2, g.FLOAT, false, 16, 0);
    g.enableVertexAttribArray(aUV);
    g.vertexAttribPointer(aUV, 2, g.FLOAT, false, 16, 8);
    g.uniform1i(loc.uTex, 0);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
  }
  try {
    initGL();
  } catch {
    gl = null;
    const c2 = document.createElement('canvas');
    c2.className = 'rig-gl';
    c2.style.cssText = canvas.style.cssText;
    canvas.replaceWith(c2);
    canvas = c2;
    ctx2d = canvas.getContext('2d');
  }

  function ibo(nx: number, ny: number) {
    const key = `${nx}x${ny}`;
    const have = ibos.get(key);
    if (have) return have;
    const idx = new Uint16Array(nx * ny * 6);
    let o = 0;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i,
          b = a + 1,
          c = a + nx + 1,
          d = c + 1;
        idx[o++] = a; idx[o++] = b; idx[o++] = c; idx[o++] = b; idx[o++] = d; idx[o++] = c;
      }
    const buf = gl!.createBuffer()!;
    gl!.bindBuffer(gl!.ELEMENT_ARRAY_BUFFER, buf);
    gl!.bufferData(gl!.ELEMENT_ARRAY_BUFFER, idx, gl!.STATIC_DRAW);
    ibos.set(key, buf);
    return buf;
  }
  /** GPU textures by image url, kept while the rig lives so switching ghosts back and forth is instant. */
  const gpu = new Map<HTMLImageElement, WebGLTexture>();
  function makeTex(img: HTMLImageElement): Tex {
    const t: Tex = { w: img.naturalWidth, h: img.naturalHeight, img };
    if (gl) {
      let tx = gpu.get(img);
      if (!tx) {
        tx = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gpu.set(img, tx);
      }
      t.t = tx;
    }
    return t;
  }

  /** The light of this frame, null when it is off; a ghost on a sheet or a card is not in front of the sky. */
  const indoors = !!host.closest('.sheet, .unlock-card');
  let light: SceneLight | null = null;
  /** How far the body is turned right now (lean and somersault), in degrees. */
  let bodyDeg = 0;
  /** A twirl shows him from behind for a moment: the body is mirrored and the face (everything skin() draws) is gone. */
  let faceK = 1;
  /** The mesh of the body: finer where parts of the picture bend at a joint, so a small part still has enough points. */
  const bodyGrid = (): [number, number] => (R.limbs ? [60, 68] : [30, 34]);
  /** For each bending part, how much of its turn every point of the body mesh takes (0: none, 1: all). */
  let limbW: { L?: Float32Array; R?: Float32Array; top?: Float32Array } = {};
  function prepareLimbs() {
    limbW = {};
    const body = TEX.body;
    if (!R.limbs || !body) return;
    const [gx, gy] = bodyGrid();
    const soft = (body.w / gx) * 2.5;
    for (const key of ['L', 'R', 'top'] as const) {
      const l = R.limbs[key];
      if (!l) continue;
      const w = new Float32Array((gx + 1) * (gy + 1));
      for (let j = 0; j <= gy; j++)
        for (let i = 0; i <= gx; i++) {
          const x = (i / gx) * body.w,
            y = (j / gy) * body.h;
          // all of the turn inside the outline; just outside it fades, so what borders on the part gives a little instead of tearing
          const edge = inShape(l.shape, x, y) ? 1 : 1 - smooth(0, soft, toShape(l.shape, x, y));
          if (edge > 0) w[j * (gx + 1) + i] = edge * smooth(l.ramp[0], l.ramp[1], Math.hypot(x - l.at[0], y - l.at[1]));
        }
      limbW[key] = w;
    }
  }
  /** hem: for the body, where its hem starts and how long it is (share of the texture height); it is a little sheer. lid: the lids over a layer of an eye. */
  function drawGrid(name: string, nx: number, ny: number, map: (s: number, t: number) => Vec, alpha: number, fx?: { level?: number; glow?: number; boost?: number; hem?: Vec; lid?: Lid }) {
    const tx = TEX[name];
    if (!tx || alpha <= 0.003) return;
    if (gl) {
      let o = 0;
      for (let j = 0; j <= ny; j++)
        for (let i = 0; i <= nx; i++) {
          const s = i / nx,
            t = j / ny,
            p = map(s, t);
          VERTS[o++] = p[0]; VERTS[o++] = p[1]; VERTS[o++] = s; VERTS[o++] = t;
        }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, VERTS, 0, o);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo(nx, ny));
      gl.bindTexture(gl.TEXTURE_2D, tx.t!);
      gl.uniform1f(loc.uAlpha, Math.min(1, alpha));
      gl.uniform1f(loc.uLevel, fx?.level ?? 0);
      gl.uniform1f(loc.uGlow, fx?.glow ?? 0);
      gl.uniform1f(loc.uBoost, fx?.boost ?? 0);
      // the hem is sheer only while the light of the scene is on
      const hem = light ? fx?.hem : undefined;
      gl.uniform1f(loc.uSheer, hem ? SHEER : 0);
      if (hem) gl.uniform2f(loc.uHem, hem[0], hem[1]);
      const lid = fx?.lid;
      if (lid) {
        gl.uniform4f(loc.uLid, lid.top, lid.bot, lid.bow, lid.line);
        gl.uniform2f(loc.uLidOff, lid.ox, lid.oy);
      } else gl.uniform4f(loc.uLid, 0, 0, 0, 0);
      gl.drawElements(gl.TRIANGLES, nx * ny * 6, gl.UNSIGNED_SHORT, 0);
    } else if (ctx2d) {
      const p0 = map(0, 0),
        p1 = map(1, 0),
        p2 = map(0, 1),
        sc = canvas.width / view.w;
      ctx2d.setTransform(
        ((p1[0] - p0[0]) / tx.w) * sc, ((p1[1] - p0[1]) / tx.w) * sc,
        ((p2[0] - p0[0]) / tx.h) * sc, ((p2[1] - p0[1]) / tx.h) * sc,
        (p0[0] - view.x) * sc, (p0[1] - view.y) * sc,
      );
      ctx2d.globalAlpha = Math.min(1, alpha);
      ctx2d.drawImage(tx.img, 0, 0);
    }
  }

  /* ---------- body deformation: body pixel (u, v) -> stage point ---------- */
  const F = { t: 0, sway: 0, drag: 0, breath: 0, sx: 1, sy: 1, c: 1, s: 0, gx: 300, gy: 280 };
  function D(u: number, v: number): Vec {
    const m = R.m;
    let x = u - R.cx,
      y = v - R.cy;
    const n = clamp((y - R.flow[0]) / R.flow[1], 0, 1),
      n2 = n * n,
      n3 = n2 * n;
    x *= 1 + F.breath * Math.exp(-(((y - R.breath[0]) / R.breath[1]) ** 2));
    x += F.sway * m * n2 + Math.sin(F.t * 2.3 - (y * 0.018) / m) * 8 * m * n3;
    y += Math.sin(F.t * 2.6 + (x * 0.017) / m) * 12 * m * n3 - F.drag * n3;
    const wt = smooth(R.tail[0], R.tail[1], u) * smooth(R.tail[2], R.tail[3], v);
    x += wt * Math.sin(F.t * 1.6) * 16 * m;
    y += wt * Math.cos(F.t * 1.6 + 0.5) * 14 * m;
    x *= F.sx;
    y = (y - R.pivot) * F.sy + R.pivot;
    return [(x * F.c - y * F.s) * R.k + F.gx, (x * F.s + y * F.c) * R.k + F.gy];
  }
  /** A texture painted onto the body mesh, centred on body point (cx, cy). */
  function skin(name: string, cx: number, cy: number, sx: number, sy: number, alpha: number, grid = 4, lid?: Lid) {
    const t = TEX[name];
    if (!t) return;
    drawGrid(name, grid, grid, (s, qq) => D(cx + (s - 0.5) * t.w * sx, cy + (qq - 0.5) * t.h * sy), alpha * faceK, lid && { lid });
  }
  /** A rigid texture fixed at body point P; local() gives the body-space offset of texture point (a, b). */
  function rigidAt(name: string, P: Vec, local: (a: number, b: number) => Vec, alpha = 1, fx?: { glow?: number }) {
    const S0 = D(P[0], P[1]),
      X = D(P[0] + 1, P[1]),
      Y = D(P[0], P[1] + 1);
    const jx = [X[0] - S0[0], X[1] - S0[1]],
      jy = [Y[0] - S0[0], Y[1] - S0[1]];
    drawGrid(name, 1, 1, (a, b) => {
      const [ox, oy] = local(a, b);
      return [S0[0] + jx[0] * ox + jy[0] * oy, S0[1] + jx[1] * ox + jy[1] * oy];
    }, alpha, fx);
  }
  /** A part on a hinge. */
  function hinged(name: string, at: Vec, anchor: Vec, deg: number, scale: number, alpha = 1, fx?: { glow?: number }) {
    const t = TEX[name];
    if (!t) return;
    rigidAt(name, at, (a, b) => rot(deg, (a * t.w - anchor[0]) * scale, (b * t.h - anchor[1]) * scale), alpha, fx);
  }

  /** How far the tuft is turned: one cut out of the finished figure takes a share of the sway, within its limit. */
  function tuftTurn(): number {
    const t = R.tuft;
    if (!t) return 0;
    return t.rest + (t.gain === undefined ? S.tuft.x : clamp(S.tuft.x * t.gain, -(t.max ?? 180), t.max ?? 180));
  }

  /* ---------- springs ---------- */
  const S = {
    squash: new Spring(1, 230, 9), lean: new Spring(0, 70, 8),
    lookX: new Spring(0, 110, 15), lookY: new Spring(0, 110, 15),
    // the eyes are quicker than the face: they dart to where the look is going
    gazeX: new Spring(0, 900, 44), gazeY: new Spring(0, 900, 44),
    eye: new Spring(1, 1500, 58), wide: new Spring(0, 160, 14),
    happy: new Spring(0, 240, 28), sleepy: new Spring(0, 26, 10), focus: new Spring(0, 40, 12),
    armL: new Spring(0, 110, 8), armR: new Spring(0, 110, 8),
    tuft: new Spring(0, 55, 4.5), glow: new Spring(0, 30, 11), ring: new Spring(0, 26, 10), low: new Spring(0, 14, 8),
    pop: new Spring(0, 520, 16), level: new Spring(0, 30, 11),
    // the charm trails behind the ghost on a soft spring
    charmX: new Spring(0, 30, 6), charmY: new Spring(0, 30, 6),
  };
  const M = { smile: new Spring(1, 900, 60), laugh: new Spring(0, 900, 60), o: new Spring(0, 900, 60), line: new Spring(0, 900, 60) };
  let mouthNow = 'smile';

  /* ---------- particles ---------- */
  const parts: Particle[] = [];
  function spawn(kind: string, x: number, y: number, vx: number, vy: number, life: number, size: number, o: { back?: boolean; rot?: number; vr?: number; g?: number } = {}) {
    if (parts.length > 90) return;
    let e: SVGElement;
    if (kind === 'z') {
      e = document.createElementNS(NS, 'text');
      e.textContent = 'z';
      e.setAttribute('font-family', 'Fredoka, Nunito, sans-serif');
      e.setAttribute('font-weight', '600');
      e.setAttribute('font-size', '30');
      e.setAttribute('text-anchor', 'middle');
      e.setAttribute('fill', '#dff1ff');
      e.setAttribute('stroke', '#0e2533');
      e.setAttribute('stroke-width', '2.2');
      e.setAttribute('paint-order', 'stroke');
    } else if (kind === 'spark') {
      e = document.createElementNS(NS, 'circle');
      e.setAttribute('r', '1');
      e.setAttribute('fill', `url(#${id}spark)`);
    } else {
      e = document.createElementNS(NS, 'path');
      e.setAttribute('d', kind === 'heart' ? HEART : STAR);
      e.setAttribute('fill', kind === 'heart' ? '#ff7aa6' : '#ffd56b');
      e.setAttribute('stroke', '#0e2533');
      e.setAttribute('stroke-width', '2.4');
      e.setAttribute('stroke-linejoin', 'round');
      e.setAttribute('vector-effect', 'non-scaling-stroke');
    }
    (o.back ? el.pBack : el.pFront).appendChild(e);
    parts.push({ el: e, kind, x, y, vx, vy, life, age: 0, size, rot: o.rot ?? 0, vr: o.vr ?? 0, g: o.g ?? 0 });
  }
  function updateParts(dt: number) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life) {
        p.el.remove();
        parts.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.kind === 'heart' || p.kind === 'z') p.x += Math.sin(p.age * 5 + p.size) * 18 * dt;
      const k = p.age / p.life,
        pop = Math.min(1, p.age / 0.22);
      const s = p.size * (p.kind === 'z' ? 0.6 + k * 0.7 : (1.7 * pop - 0.7 * pop * pop) * (1 - 0.3 * k));
      p.el.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${p.rot.toFixed(1)}) scale(${Math.max(0.01, s).toFixed(3)})`);
      p.el.setAttribute('opacity', (1 - k * k).toFixed(3));
    }
  }

  /* ---------- aura ---------- */
  const aura = new AuraSim(look.style?.aura, Math.random, reduce);
  const auraSvg = new SvgAura(el.pBack, el.pFront);
  let shimmerFrame = 0;
  const auraBox = (): AuraBox => ({ cx: 300, cy: ghostY + 30, rx: 150, ry: 190, glow: glowRgb });

  /* ---------- charm ---------- */
  const CHARM_SIZE = 96;
  const charmG = document.createElementNS(NS, 'g');
  charmG.innerHTML = `<circle r="50" fill="url(#${id}glow)" opacity="0.75"/><image preserveAspectRatio="xMidYMid meet"/>`;
  const charmImage = charmG.querySelector('image') as SVGImageElement;
  el.pFront.appendChild(charmG);
  let charmOn = false,
    charmFresh = true,
    spinAt = -9;
  function setCharm(cid: string | undefined) {
    const def = cid ? CHARMS.find((c) => c.id === cid) : undefined;
    charmOn = !!def;
    charmG.style.display = def ? '' : 'none';
    if (!def) return;
    const k = CHARM_SIZE / Math.max(def.w, def.h);
    const w = def.w * k,
      h = def.h * k;
    charmImage.setAttribute('href', charmImg(def.id));
    charmImage.setAttribute('x', (-w / 2).toFixed(1));
    charmImage.setAttribute('y', (-h / 2).toFixed(1));
    charmImage.setAttribute('width', w.toFixed(1));
    charmImage.setAttribute('height', h.toFixed(1));
  }
  setCharm(look.style?.charm);
  /** Places the charm beside the left shoulder, clear of body and arm; above left, outside the charge ring, while focusing. */
  function drawCharm(sleepy: number) {
    if (!charmOn) return;
    const a = R.armL;
    const sh = D(a.at[0], a.at[1]);
    // the hand as the arm swings right now: the charm keeps clear of it
    const off = rot(armTurn(a, S.armL.x, true), (a.hand[0] - a.anchor[0]) * a.s, (a.hand[1] - a.anchor[1]) * a.s);
    const hand = D(a.at[0] + off[0], a.at[1] + off[1]);
    const half = CHARM_SIZE / 2;
    const left = view.x + half + 4,
      top = view.y + half + 4;
    const sideX = Math.max(left, Math.min(hand[0], sh[0]) - half - 6),
      sideY = Math.max(top, Math.min(sh[1], hand[1]) - 44);
    // with the charge ring showing it waits above left, outside the ring
    const ring = clamp(S.ring.x, 0, 1);
    const ringX = Math.max(left, 300 - 192),
      ringY = Math.max(top, 300 - 192);
    // while he twirls his shoulder passes through the middle; the charm waits where it was
    if (!(turn > 0.001 && turn < 0.999)) {
      S.charmX.t = sideX + (ringX - sideX) * ring;
      S.charmY.t = sideY + (ringY - sideY) * ring;
    }
    if (charmFresh) {
      S.charmX.x = S.charmX.t;
      S.charmY.x = S.charmY.t;
      S.charmX.v = S.charmY.v = 0;
      charmFresh = false;
    }
    const bob = reduce ? 0 : Math.sin(T * 1.9 + 1) * 7 * (1 - 0.6 * sleepy);
    const tilt = (reduce ? 0 : Math.sin(T * 1.3) * 7 * (1 - 0.5 * sleepy)) + clamp(S.charmX.v * 0.06, -16, 16);
    const sp = (T - spinAt) / 0.9;
    const spin = sp >= 0 && sp < 1 ? 360 * (1 - (1 - sp) ** 3) : 0;
    charmG.setAttribute('transform', `translate(${S.charmX.x.toFixed(1)},${(S.charmY.x + bob).toFixed(1)}) rotate(${(tilt + spin).toFixed(1)})`);
    charmG.setAttribute('opacity', (1 - 0.45 * sleepy).toFixed(3));
  }

  /* ---------- behaviour ---------- */
  let ghostY = 280, T = 0, waveT = 0, phase = 0, mode: RigMode = 'idle';
  let level = 0, ringP: number | null = null;
  let hopY = 0, hopV = 0, jumpAt = -1, jumpV = 0;
  let nextBlink = 1.4, blinkEnd = -1, nextLook = 0.8, nextFidget = 4 + Math.random() * 3, waveUntil = 0;
  let happyUntil = 0, wideUntil = 0, flashUntil = 0, zNext = 0, sparkNext = 0;
  // acts (see acts.ts): what he does on his own at rest, and reactions that wait until he is free.
  // frozen: the preview tools hold an act at a moment
  let act: { name: ActName; t0: number; fired: boolean; frozen?: number } | null = null;
  let nextAct = 9 + Math.random() * 8, lastAct: ActName | null = null, queued: ActName | null = null;
  // what the running act asks of the face and the body, read when the frame is drawn
  let actShut = 0, actSmile = false, actMouth = 1, turn = 0;
  let fullSparkNext = 0;
  let tuftAt: Vec = [300, 120];
  const pointer = { x: 300, y: 300, last: -10 };
  // a glance at something on the screen, and the small jumps the eyes make on their own
  const glanceAt = { x: 300, y: 300, until: 0 };
  let nextDart = 1, dartX = 0, dartY = 0;
  // gestures: stroking, holding and tickling (a tap stays a poke)
  const gest = new GestureTracker();
  let gestId = -1;
  let stroking = false, strokeT0 = 0, strokeRun = 0, strokeHeartAt = -9, sighed = false;
  let holding = false, saltoAt = -9, sleepSmileUntil = 0;
  // bond perks: a hug after a long stroke, a high five instead of a squeeze
  let bond = 0, hugAt = -9, highFive = false, layerK = 1;
  const HUG_S = 1.7;

  function jump(v: number) {
    if (reduce) return;
    S.squash.v -= 3.2;
    jumpAt = T + 0.09;
    jumpV = v;
  }
  /** Wakes him if he sleeps; true when he did. */
  function wakeUp() {
    if (mode !== 'sleep') return false;
    mode = 'idle';
    opts.onWake?.();
    return true;
  }
  function startAct(name: ActName) {
    if (reduce) return;
    act = { name, t0: T, fired: false };
    if (IDLE_ACTS.includes(name)) lastAct = name;
    if (name === 'twirl') {
      jump(280);
      spinAt = T;
    }
    if (name === 'nod') S.squash.v -= 1.2;
    // no z rises while he still yawns
    if (name === 'yawn') zNext = Math.max(zNext, T + ACT_SECONDS.yawn);
  }
  function endAct() {
    if (!act) return;
    act = null;
    if (!holding) S.squash.t = 1;
  }
  function celebrate(big = true) {
    endAct();
    wakeUp();
    aura.burst(auraBox(), big ? 10 : 6);
    spinAt = T + 0.1;
    jump(big ? 760 : 520);
    happyUntil = T + (big ? 1.9 : 1.3);
    flashUntil = T + 0.5;
    const n = reduce ? 5 : big ? 12 : 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3,
        sp = 250 + Math.random() * 170;
      spawn('star', 300, ghostY + 40, Math.cos(a) * sp, Math.sin(a) * sp - 120, 1.1 + Math.random() * 0.4, 0.8 + Math.random() * 0.7, { g: 520, rot: Math.random() * 90, vr: (Math.random() - 0.5) * 400, back: true });
    }
    if (big) for (let i = 0; i < 3; i++) spawn('heart', 250 + i * 50, ghostY - 190, (i - 1) * 50, -230 - Math.random() * 60, 1.6, 1.1, { g: 90 });
  }
  function poke() {
    if (wakeUp()) {
      wideUntil = T + 0.9;
      jump(430);
      opts.onPoke?.();
      return;
    }
    S.squash.v -= 4.6;
    S.lean.v += (Math.random() < 0.5 ? -1 : 1) * 95;
    happyUntil = T + 1.15;
    for (let i = 0; i < 3; i++) spawn('heart', 300 + (i - 1) * 38 + (Math.random() - 0.5) * 16, ghostY - 150, (i - 1) * 30, -120 - Math.random() * 50, 1.5, 0.9 + Math.random() * 0.4, { g: 40 });
    opts.onPoke?.();
  }
  /** Quick taps in a row: he giggles and flips. */
  function tickle() {
    wakeUp();
    happyUntil = T + 1.4;
    S.squash.v -= 3;
    S.lean.v += (Math.random() < 0.5 ? -1 : 1) * 120;
    if (!reduce && T - saltoAt > 0.85) {
      saltoAt = T;
      jump(600);
    }
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      spawn('star', 300 + Math.cos(a) * 120, ghostY + Math.sin(a) * 110, Math.cos(a) * 120, Math.sin(a) * 120 - 80, 0.8, 0.6 + Math.random() * 0.4, { g: 200, rot: Math.random() * 90, vr: 300 });
    }
  }
  /** Pressed and held: squashed, wide eyes, trembling; on release he pops back with a hop. */
  function holdStart() {
    wakeUp();
    holding = true;
    wideUntil = T + 60;
    // best friends: he raises a hand for a high five instead of being squeezed
    highFive = bond >= 3;
    if (!highFive) S.squash.t = 0.84;
  }
  /** Where a hand is right now, in stage units. */
  function handAt(left: boolean): Vec {
    const a = left ? R.armL : R.armR;
    const off = rot(armTurn(a, left ? S.armL.x : S.armR.x, left), (a.hand[0] - a.anchor[0]) * a.s, (a.hand[1] - a.anchor[1]) * a.s);
    return D(a.at[0] + off[0], a.at[1] + off[1]);
  }
  function holdEnd() {
    if (!holding) return;
    holding = false;
    if (highFive) {
      highFive = false;
      wideUntil = T;
      happyUntil = T + 1.3;
      flashUntil = T + 0.35;
      S.squash.v -= 3.5;
      S.lean.v -= 60;
      const [hx, hy] = handAt(false);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        spawn('star', hx, hy, Math.cos(a) * 230, Math.sin(a) * 230 - 60, 0.75, 0.55 + Math.random() * 0.4, { g: 260, rot: Math.random() * 90, vr: 360 });
      }
      jump(360);
      return;
    }
    S.squash.t = 1;
    S.squash.v += 2;
    wideUntil = T;
    happyUntil = T + 1.1;
    jump(420);
  }
  /** Stroked: eyes closed, leaning into the finger, a heart now and then; asleep he only smiles. */
  function strokeMove(dx: number, dy: number) {
    const u = view.w / Math.max(1, layerBox.w);
    const sx = dx * u,
      sy = dy * u;
    S.lean.v += clamp(sx * 1.6, -26, 26);
    if (mode === 'sleep') sleepSmileUntil = T + 0.7;
    else happyUntil = Math.max(happyUntil, T + 0.4);
    strokeRun += Math.hypot(sx, sy);
    if (strokeRun >= 150 && T - strokeHeartAt > 0.22) {
      strokeRun = 0;
      strokeHeartAt = T;
      spawn('heart', pointer.x + (Math.random() - 0.5) * 30, pointer.y - 30, (Math.random() - 0.5) * 40, -110 - Math.random() * 40, 1.3, 0.7 + Math.random() * 0.35, { g: 30 });
    }
  }
  function onGesture(g: Gesture) {
    // a touch ends whatever he was doing on his own
    endAct();
    if (g.kind === 'tap') poke();
    else if (g.kind === 'tickle') tickle();
    else if (g.kind === 'holdStart') holdStart();
    else if (g.kind === 'holdEnd') holdEnd();
    else if (g.kind === 'strokeStart') {
      stroking = true;
      strokeT0 = T;
      strokeRun = 0;
      sighed = false;
    } else if (g.kind === 'stroke') strokeMove(g.dx, g.dy);
    else if (g.kind === 'strokeEnd') stroking = false;
    opts.onGesture?.(g);
  }
  const emit = (gs: Gesture[]) => gs.forEach(onGesture);

  function tick(dt: number) {
    T += dt;
    emit(gest.update(performance.now()));
    if (holding && !highFive && !reduce) S.lean.v += Math.sin(T * 41) * 1100 * dt;
    // after a few seconds of stroking: a content sigh and a big heart
    if (stroking && !sighed && T - strokeT0 > 4) {
      sighed = true;
      S.squash.v -= 2.6;
      spawn('heart', 300, ghostY - 170, 0, -90, 1.8, 1.5, { g: 20 });
      // friends: he opens his arms and comes close for a hug
      if (bond >= 2 && mode !== 'sleep') {
        hugAt = T;
        happyUntil = T + HUG_S;
        opts.onHug?.();
        for (let i = 0; i < 5; i++) spawn('heart', 300 + (i - 2) * 55, ghostY - 120 - Math.abs(i - 2) * 18, (i - 2) * 40, -140 - Math.random() * 40, 1.6, 0.8 + Math.random() * 0.4, { g: 40 });
      }
    }
    const sleepy = S.sleepy.x;
    waveT += reduce ? 0 : dt * (1 - 0.55 * sleepy);
    phase += reduce ? 0 : dt * 1.5 * (1 - 0.45 * sleepy);

    if (T >= nextBlink) {
      if (mode !== 'sleep' && S.happy.x < 0.5) {
        S.eye.t = 0;
        blinkEnd = T + 0.085;
      }
      nextBlink = T + (Math.random() < 0.2 ? 0.3 : 2.2 + Math.random() * 3.6);
    }
    if (T >= blinkEnd) S.eye.t = 1;

    if (mode === 'sleep') {
      S.lookX.t = 0;
      S.lookY.t = 0.2;
    } else if (mode === 'focus') {
      S.lookX.t = Math.sin(T * 0.7) * 0.18;
      S.lookY.t = 0.6;
    } else if (T - pointer.last < 2.5) {
      S.lookX.t = clamp((pointer.x - 300) / 230, -1, 1);
      S.lookY.t = clamp((pointer.y - ghostY - 20) / 230, -1, 1);
    } else if (T < glanceAt.until) {
      S.lookX.t = clamp((glanceAt.x - 300) / 230, -1, 1);
      S.lookY.t = clamp((glanceAt.y - ghostY - 20) / 230, -1, 1);
      nextLook = Math.max(nextLook, glanceAt.until);
    } else if (T >= nextLook) {
      const center = Math.random() < 0.4;
      S.lookX.t = center ? 0 : Math.random() * 1.6 - 0.8;
      S.lookY.t = center ? 0 : Math.random() * 1.0 - 0.45;
      nextLook = T + 1.2 + Math.random() * 2.8;
    }
    // now and then, at rest, he does something of his own; a reaction waits until he is free
    const busy = !!act || holding || stroking || T < happyUntil || T - hugAt < HUG_S || T - pointer.last < 3 || T < glanceAt.until || T < waveUntil || !!eyePose();
    if (queued && !act && !holding && !stroking && T >= happyUntil) {
      startAct(queued);
      queued = null;
    } else if (T >= nextAct && mayAct({ mode, busy, off: reduce || opts.idleActs === false })) {
      // without an arm to draw there is no hand to nudge the charm with
      const name = pickAct({ sky: !indoors && lightOn(), charm: charmOn && !R.baked?.includes('arms'), tired: !!opts.tired }, lastAct, Math.random());
      if (name) startAct(name);
      nextAct = T + actGap(Math.random());
    } else if (eagerActs() && nextAct - T > 6) {
      // switched on in the developer menu while he was still waiting for the usual gap
      nextAct = T + actGap(Math.random());
    }
    const actAt = act ? (act.frozen ?? T - act.t0) : 0;
    const pose = act ? actPose(act.name, actAt, indoors ? null : sceneLight().dir) : null;
    if (act && !pose) endAct();
    if (pose?.look) {
      S.lookX.t = pose.look[0];
      S.lookY.t = pose.look[1];
    }
    actShut = pose?.shut ?? 0;
    actSmile = !!pose?.smile;
    actMouth = pose?.mouthScale ?? 1;
    turn = pose?.turn ?? 0;
    if (pose) S.squash.t = pose.squash ?? 1;
    if (act && pose && !act.fired) {
      if (act.name === 'charm' && actAt >= CHARM_PUSH_AT) {
        // the push: the charm swings away and spins once
        act.fired = true;
        S.charmX.v -= 250;
        S.charmY.v -= 130;
        spinAt = T;
      } else if (act.name === 'proud' && actAt >= PROUD_SPARKLE_AT) {
        act.fired = true;
        flashUntil = T + 0.4;
        for (let i = 0; i < 4; i++) spawn('star', 300 + (i - 1.5) * 74, ghostY - 150 - (i % 2) * 34, (i - 1.5) * 26, -70 - Math.random() * 40, 1.1, 0.6 + Math.random() * 0.3, { g: 120, rot: Math.random() * 90, vr: 220 });
      }
    }
    // at rest the eyes make small jumps of their own; they hold still while they follow something
    const resting = mode === 'idle' && !act && !reduce && T - pointer.last >= 2.5 && T >= glanceAt.until;
    if (!resting) dartX = dartY = 0;
    else if (T >= nextDart) {
      dartX = (Math.random() - 0.5) * 0.5;
      dartY = (Math.random() - 0.5) * 0.3;
      nextDart = T + 0.5 + Math.random() * 1.7;
    }
    const fixed = eyePose();
    if (fixed) {
      S.lookX.t = fixed.x;
      S.lookY.t = fixed.y;
    }
    S.gazeX.t = clamp(S.lookX.t * 1.2 + (fixed ? 0 : dartX), -1, 1);
    S.gazeY.t = clamp(S.lookY.t * 1.2 + (fixed ? 0 : dartY), -1, 1);

    if (mode === 'idle' && T >= nextFidget && !reduce && !eyePose() && !act) {
      const r = Math.random();
      if (r < 0.4) waveUntil = T + 1.3;
      else if (r < 0.7) S.lean.v += (Math.random() < 0.5 ? -1 : 1) * 70;
      else jump(300);
      nextFidget = T + 6 + Math.random() * 6;
    }

    const happy = T < happyUntil;
    S.happy.t = happy ? 1 : 0;
    S.wide.t = T < wideUntil || pose?.wide ? 1 : 0;
    S.focus.t = mode === 'focus' ? 1 : 0;
    S.sleepy.t = mode === 'sleep' ? 1 : 0;
    S.low.t = mode === 'sleep' ? 1 : 0;
    S.lean.t = (mode === 'idle' ? S.lookX.x * 5 : 0) + (pose?.lean ?? 0);
    const want = happy ? 'laugh' : (pose?.mouth ?? (T < wideUntil ? 'o' : mode === 'focus' ? 'line' : mode === 'sleep' ? (T < sleepSmileUntil ? 'smile' : 'o') : 'smile'));
    if (want !== mouthNow) {
      mouthNow = want;
      S.pop.v += 5;
    }
    for (const key of Object.keys(M) as (keyof typeof M)[]) M[key].t = key === want ? 1 : 0;

    const sw = reduce ? 0 : Math.sin(T * 1.8) * 5;
    let aL = sw,
      aR = -(reduce ? 0 : Math.sin(T * 1.8 + 1) * 5);
    if (mode === 'focus') {
      aL = -16 + sw * 0.4;
      aR = 16 - sw * 0.4;
    }
    if (mode === 'sleep') {
      aL = -26;
      aR = 26;
    }
    if (T < waveUntil && mode === 'idle') aR = -70 - Math.sin(T * 16) * 22;
    if (happy) {
      aL = 60 + Math.sin(T * 15) * 14;
      aR = -60 - Math.sin(T * 15 + 0.6) * 14;
    }
    if (T - hugAt < HUG_S) {
      aL = 88;
      aR = -88;
    }
    if (holding && highFive) {
      aR = -112 + (reduce ? 0 : Math.sin(T * 7) * 5);
      aL = Math.min(aL, 10);
    }
    if (pose?.armL !== undefined) aL = pose.armL;
    if (pose?.armR !== undefined) aR = pose.armR;
    S.armL.t = aL;
    S.armR.t = aR;

    if (mode === 'focus' && T >= sparkNext && !reduce) {
      spawn('spark', 300 + (Math.random() - 0.5) * 250, 480 - Math.random() * 60, (Math.random() - 0.5) * 20, -90 - Math.random() * 90, 1.4 + Math.random() * 0.8, 5 + Math.random() * 5);
      sparkNext = T + 0.09;
    }
    // fully charged: small sparks rise from his tuft
    if (mode === 'idle' && level >= 0.98 && T >= fullSparkNext && !reduce) {
      spawn('spark', tuftAt[0] + (Math.random() - 0.5) * 26, tuftAt[1] + (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 34, -34 - Math.random() * 46, 0.8 + Math.random() * 0.5, 3 + Math.random() * 3);
      fullSparkNext = T + 0.3 + Math.random() * 0.5;
    }
    if (mode === 'sleep' && T >= zNext) {
      spawn('z', 395, ghostY - 120, 16, -30, 2.8, 1.35);
      zNext = T + 1.7;
    }

    S.level.t = level;
    S.glow.t = level * 0.8 + (T < flashUntil ? 0.9 : 0) - sleepy * 0.15;
    S.ring.t = ringP === null ? 0 : 1;

    let acc = dt;
    while (acc > 1e-6) {
      const h = Math.min(acc, 1 / 120);
      for (const s of Object.values(S)) s.step(h);
      for (const s of Object.values(M)) s.step(h);
      if (jumpAt > 0 && T >= jumpAt) {
        hopV = -jumpV;
        S.squash.v += 3.5;
        jumpAt = -1;
      }
      if (hopY < 0 || hopV < 0) {
        hopV += 2600 * h;
        hopY += hopV * h;
        if (hopY >= 0) {
          S.squash.v -= Math.min(6.5, hopV * 0.0065);
          hopY = 0;
          hopV = 0;
        }
      }
      acc -= h;
    }
    S.tuft.t = -S.lean.x * 0.8 + clamp(hopV * 0.02, -16, 16) + sleepy * 24 + Math.sin(T * 2.2) * 4 * (1 - sleepy);
    updateParts(dt);
    aura.step(dt, auraBox(), mode);
    if (shimmerMoves(shimmer)) {
      glowRgb = shimmerRgb(shimmer, ghost(cur.ghost).glow, T);
      // the SVG gradients follow at half the frame rate, which is plenty for a colour drift
      if ((shimmerFrame = (shimmerFrame + 1) % 2) === 0) setGradientColor(rgbCss(glowRgb));
    }
  }

  /* ---------- draw ---------- */
  const RING_C = 2 * Math.PI * 205;
  let loaded = false;
  function render() {
    if (!loaded || !alive) return;
    const sleepy = clamp(S.sleepy.x, 0, 1),
      happy = clamp(S.happy.x, 0, 1),
      focus = clamp(S.focus.x, 0, 1);
    const lv = clamp(S.level.x, 0, 1);
    const amp = reduce ? 0 : 9 * (1 - 0.45 * sleepy);
    const floatY = Math.sin(phase) * amp;
    const velY = Math.cos(phase) * amp * 1.5 + hopV;

    const sy = S.squash.x;
    F.t = waveT;
    F.sway = (reduce ? 0 : Math.sin(waveT * 1.1) * 12) - clamp(S.lean.v * 0.28, -40, 40);
    F.drag = clamp(velY * 0.035, -30, 30) / R.k;
    F.breath = reduce ? 0 : Math.sin(T * 2.3) * 0.014 * (1 + sleepy);
    F.sy = sy;
    // a twirl: he turns around his own axis, so his width goes through zero and comes back mirrored
    let tc = Math.cos(turn * 2 * Math.PI);
    if (Math.abs(tc) < 0.05) tc = tc < 0 ? -0.05 : 0.05;
    faceK = clamp(tc * 6, 0, 1);
    F.sx = (1 + (1 - sy) * 0.85) * tc;
    const sp = (T - saltoAt) / 0.7;
    const salto = sp >= 0 && sp < 1 ? 360 * (sp < 0.5 ? 2 * sp * sp : 1 - (-2 * sp + 2) ** 2 / 2) : 0;
    bodyDeg = S.lean.x + salto;
    F.c = Math.cos(bodyDeg * RAD);
    F.s = Math.sin(bodyDeg * RAD);
    F.gx = 300;
    F.gy = 280 + shiftY + floatY + hopY + S.low.x * 20;
    ghostY = F.gy;
    const hp = (T - hugAt) / HUG_S;
    const k = !reduce && hp >= 0 && hp < 1 ? 1 + 0.14 * Math.sin(Math.PI * Math.min(1, hp * 1.25)) ** 2 : 1;
    if (k !== layerK) {
      layerK = k;
      if (k === 1) layer.style.transform = '';
      else {
        layer.style.transformOrigin = `${(((300 - view.x) / view.w) * layerBox.w).toFixed(0)}px ${(((ghostY - view.y) / view.h) * layerBox.h).toFixed(0)}px`;
        layer.style.transform = `scale(${k.toFixed(4)})`;
      }
    }

    const lift = -(floatY + hopY);
    const shY = SHADOW_Y + shiftY + S.low.x * 12;
    el.shadow.setAttribute('transform', `translate(300,${shY.toFixed(1)}) scale(${clamp(1 - lift * 0.0028, 0.45, 1.2).toFixed(3)},1) translate(-300,-${SHADOW_Y})`);
    el.shadow.setAttribute('opacity', clamp(0.55 - lift * 0.0022, 0.12, 0.7).toFixed(3));
    el.glow.setAttribute('cy', (F.gy + 20).toFixed(1));
    el.glow.setAttribute('opacity', clamp(0.3 + S.glow.x * 0.6, 0.1, 1).toFixed(3));
    el.ring.setAttribute('opacity', clamp(S.ring.x, 0, 1).toFixed(3));
    el.ring.setAttribute('transform', `rotate(-90 300 ${300 + shiftY})`);
    el.ring.querySelectorAll('circle').forEach((c) => c.setAttribute('cy', String(300 + shiftY)));
    const rp = clamp(ringP ?? 0, 0, 1);
    el.ringFill.setAttribute('stroke-dashoffset', (RING_C * (1 - rp)).toFixed(1));
    // a point of light leads the arc; the ring group is turned, so angle 0 is at the top
    const ra = rp * Math.PI * 2;
    el.ringHead.setAttribute('transform', `translate(${(300 + 205 * Math.cos(ra)).toFixed(1)},${(300 + shiftY + 205 * Math.sin(ra)).toFixed(1)})`);
    el.ringHead.setAttribute('opacity', rp > 0.004 ? '1' : '0');
    // the glow at full charge sits on the tuft; on a lantern it sits in the lamp and sways with it
    const lamp = R.tuft?.light ? rot(tuftTurn(), R.tuft.light[0] - R.tuft.at[0], R.tuft.light[1] - R.tuft.at[1]) : null;
    const tg = R.tuft ? (lamp ? D(R.tuft.at[0] + lamp[0], R.tuft.at[1] + lamp[1]) : D(R.tuft.at[0], R.tuft.at[1] - 80 * R.m)) : D(R.cx, R.top + 30 * R.m);
    tuftAt = tg;
    el.tuftGlow.setAttribute('cx', tg[0].toFixed(1));
    el.tuftGlow.setAttribute('cy', tg[1].toFixed(1));
    el.tuftGlow.setAttribute('opacity', clamp(lv * 1.1 + (T < flashUntil ? 0.8 : 0), 0, 1).toFixed(3));
    el.hit.setAttribute('cy', (F.gy + 22).toFixed(1));

    if (gl) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform4f(loc.uView, view.x, view.y, 2 / view.w, 2 / view.h);
      gl.uniform1f(loc.uTime, T);
      gl.uniform1f(loc.uDim, sleepy);
      gl.uniform3f(loc.uFill, glowRgb[0], glowRgb[1], glowRgb[2]);
      // the light of the scene: a slight tint over the whole figure
      light = lightOn() ? (indoors ? NEUTRAL_LIGHT : sceneLight()) : null;
      const lt = light?.tint ?? [1, 1, 1];
      gl.uniform3f(loc.uTint, lt[0], lt[1], lt[2]);
      const ink = EYES[cur.ghost]?.ink ?? [0, 0, 0];
      gl.uniform3f(loc.uInk, ink[0], ink[1], ink[2]);
    } else if (ctx2d) {
      ctx2d.setTransform(1, 0, 0, 1, 0, 0);
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    }
    const flash = T < flashUntil ? 0.9 : 0;
    const body = TEX.body;
    const [gx, gy] = bodyGrid();
    // parts of the picture that bend: how far each one is turned right now
    const bent: [Float32Array, Limb, number][] = [];
    // at rest an arm on a hinge sways by a few degrees; a bending part takes only a share of that, so it gets a sway of its own
    const sway = reduce || mode !== 'idle' ? 0 : 2.2 * (1 - sleepy);
    for (const [key, deg, own] of [['L', S.armL.x, Math.sin(T * 1.7) * sway], ['R', S.armR.x, -Math.sin(T * 1.7 + 0.9) * sway], ['top', S.tuft.x, 0]] as const) {
      const l = R.limbs?.[key],
        w = limbW[key];
      if (!l || !w) continue;
      // a positive turn raises the left part and lowers the right one
      const up = l.lift ?? l.max;
      bent.push([w, l, key === 'R' ? clamp(deg * l.gain + own, -up, l.max) : clamp(deg * l.gain + own, -l.max, key === 'L' ? up : l.max)]);
    }
    const onBody = (s: number, qq: number) => {
      let x = s * body.w,
        y = qq * body.h;
      if (bent.length) {
        const i = Math.round(qq * gy) * (gx + 1) + Math.round(s * gx);
        for (const [w, l, deg] of bent) {
          if (w[i] <= 0) continue;
          const p = rot(deg * w[i], x - l.at[0], y - l.at[1]);
          x = l.at[0] + p[0];
          y = l.at[1] + p[1];
        }
      }
      return D(x, y);
    };
    const hem: Vec = [(R.cy + R.flow[0]) / body.h, R.flow[1] / body.h];
    // an arm that lies behind the body is drawn before it, the others after the face
    const drawArm = (left: boolean) => {
      const a = left ? R.armL : R.armR;
      hinged(left ? 'arm_L' : 'arm_R', a.at, a.anchor, armTurn(a, left ? S.armL.x : S.armR.x, left), a.s);
    };
    if (R.armL.back) drawArm(true);
    if (R.armR.back) drawArm(false);
    if (R.tuft) hinged('tuft', R.tuft.at, R.tuft.anchor, tuftTurn(), 1, 1, { glow: clamp(lv * 0.9 + flash, 0, 1.2) });
    drawGrid('body', gx, gy, onBody, 1, { level: lv, glow: clamp((S.glow.x - lv * 0.6) * 0.6, 0, 1), boost: focus, hem });

    const u = R.u,
      fs = R.fs;
    const lx = S.lookX.x,
      ly = S.lookY.x;
    const fx = R.cx + lx * 24 * u,
      fy = (ly * 14 + sleepy * 8) * u;
    const bs = R.blush[2] * (1 + happy * 0.08);
    const ba = 0.8 + happy * 0.2 - sleepy * 0.25;
    skin('blush_L', fx - R.blush[0], R.blush[1] + fy, bs, bs, ba);
    skin('blush_R', fx + R.blush[0], R.blush[1] + fy, bs, bs, ba);

    const fixed = eyePose();
    const blinkC = 1 - clamp(S.eye.x, 0, 1);
    const own = Math.max(happy, sleepy, blinkC);
    const close = fixed ? clamp(fixed.shut, 0, 1) : Math.max(own, actShut);
    const w = 1 + clamp(S.wide.x, 0, 1.2) * 0.14;
    // an act that shuts the eyes further than he would himself also says how they close
    const happyArc = fixed ? !!fixed.smile : actShut > own ? actSmile : happy >= Math.max(sleepy, blinkC);
    const ex = lx * 12 * u,
      ey = R.eyeY + fy + ly * 9 * u;
    // eyes in layers (WebGL only): lids close over them, the inside follows the gaze and the highlights nearly stay
    const kit = gl && !fixed?.flat && (TEX.eye_back_L || TEX.eye_back_R) ? EYES[cur.ghost] : undefined;
    if (kit) {
      const shut = clamp(1 - (1 - close) * (1 - 0.24 * focus), 0, 1);
      const openA = 1 - smooth(0.8, 0.94, shut),
        arcA = 1 - openA;
      const L = lids(shut, happyArc);
      const [px, py] = pupilShift(S.gazeX.x, S.gazeY.x, kit.shift);
      const sc = w * fs;
      for (const side of [-1, 1]) {
        const tag = side < 0 ? 'L' : 'R';
        const back = TEX[`eye_back_${tag}`];
        if (!R.eyes.includes(tag) || !back) continue;
        const cx = fx + side * R.eyeDX + ex;
        // a layer of the eye, moved by (mx, my) pixels of the eye part
        const part = (name: string, mx: number, my: number) =>
          skin(`eye_${name}_${tag}`, cx + mx * sc, ey + my * sc, sc, sc, openA, 4, shut > 0.004 ? { ...L, line: (kit.rim * 0.9) / back.h, ox: mx / back.w, oy: my / back.h } : undefined);
        part('back', 0, 0);
        part('iris', px, py);
        part('ring', 0, 0);
        part('glint', px * GLINT_FOLLOW, py * GLINT_FOLLOW);
        if (happyArc) skin(`eye_happy_${tag}`, cx, ey - 4 * u, fs, fs, arcA);
        else skin(`eye_sleep_${tag}`, cx, ey + 20 * u, fs, fs, arcA);
      }
    } else {
      // one flat picture per eye: it is squeezed shut
      const eyeSy = w * (1 - 0.18 * focus) * (1 - close);
      const openA = smooth(0.2, 0.3, eyeSy),
        arcA = 1 - openA;
      for (const side of [-1, 1]) {
        const tag = side < 0 ? 'L' : 'R';
        if (!R.eyes.includes(tag)) continue;
        const cx = fx + side * R.eyeDX + ex;
        skin(`eye_open_${tag}`, cx, ey + 20 * u * (1 - eyeSy / w), w * fs, Math.max(0.05, eyeSy) * fs, openA);
        if (happyArc) skin(`eye_happy_${tag}`, cx, ey - 4 * u, fs, fs, arcA);
        else skin(`eye_sleep_${tag}`, cx, ey + 20 * u, fs, fs, arcA);
      }
    }

    // mouth shapes keep Volti's proportions to each other (smile 0.8, line 0.7, o 0.75)
    const pop = 1 + S.pop.x * 0.6;
    const ms = R.ms,
      mk = (ms / 0.8) * pop;
    const my = R.mouth[1] + fy + ly * 4 * u,
      mx = R.mouth[0] + lx * 30 * u;
    skin('mouth_smile', mx, my, ms * pop * actMouth, ms * pop * actMouth, M.smile.x);
    skin('mouth_line', mx, my + 4 * u, 0.7 * mk, 0.7 * mk, M.line.x);
    const os = (0.75 - 0.25 * sleepy) * mk * actMouth;
    const breathe = 1 + Math.sin(T * 1.6) * 0.14 * sleepy;
    skin('mouth_o', mx, my + 4 * u, os, os * breathe, M.o.x);
    const chatter = 1 + (reduce ? 0 : Math.sin(T * 17) * 0.07 * happy);
    skin('mouth_laugh', mx, my + 16 * u, ms * pop, ms * pop * chatter, M.laugh.x);

    if (!R.armL.back) drawArm(true);
    if (!R.armR.back) drawArm(false);
    auraSvg.setGlow(glowRgb);
    auraSvg.sync(aura, mode === 'focus');
    drawCharm(sleepy);
  }

  /* ---------- input ---------- */
  function toStage(clientX: number, clientY: number) {
    const r = layer.getBoundingClientRect();
    return { x: view.x + ((clientX - r.left) / r.width) * view.w, y: view.y + ((clientY - r.top) / r.height) * view.h };
  }
  /** A finger anywhere on the screen draws his eyes. */
  const onSee = (e: PointerEvent) => {
    const p = toStage(e.clientX, e.clientY);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.last = T;
  };
  const onMove = (e: PointerEvent) => {
    onSee(e);
    if (e.pointerId === gestId) emit(gest.move(e.clientX, e.clientY, performance.now()));
  };
  const onDown = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    onMove(e);
    gestId = e.pointerId;
    emit(gest.down(e.clientX, e.clientY, performance.now(), e.pointerType === 'touch'));
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== gestId) return;
    gestId = -1;
    emit(gest.up(performance.now()));
  };
  const onCancel = (e: PointerEvent) => {
    if (e.pointerId !== gestId) return;
    gestId = -1;
    emit(gest.cancel(performance.now()));
  };
  if (opts.interactive) {
    window.addEventListener('pointerdown', onSee, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    el.hit.addEventListener('pointerdown', onDown);
  }

  // the preview tools play an act on every ghost on screen, or hold it at a moment
  const offPlay = onPlayAct((name, at) => {
    if (name === null) endAct();
    else if (at === undefined) startAct(name);
    else act = { name, t0: T, fired: true, frozen: at };
  });

  /* ---------- loop ---------- */
  layout();
  const ro = new ResizeObserver(() => {
    layout();
    render();
  });
  ro.observe(host);
  let last = performance.now();
  let raf = 0;
  function frame(now: number) {
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    tick(dt);
    render();
    raf = requestAnimationFrame(frame);
  }

  function setGradientColor(color: string) {
    layer.querySelectorAll(`#${id}glow stop, #${id}tuft stop:last-child, #${id}spark stop:last-child`).forEach((s) => s.setAttribute('stop-color', color));
    layer.querySelectorAll('[data-k="ring"] circle').forEach((c) => c.setAttribute('stroke', color));
    layer.querySelectorAll('[data-k="ringHalo"]').forEach((c) => c.setAttribute('fill', color));
  }

  /** Loads a look, then swaps everything at once so the ghost never shows half-loaded. */
  let req = 0;
  async function apply(l: Look) {
    const my = ++req;
    const ghostChanged = cur.ghost !== l.ghost || !loaded;
    if (ghostChanged) {
      const imgs = await preloadLook(l, true);
      if (!alive || my !== req) return;
      const next: Record<string, Tex> = {};
      for (const [k, im] of Object.entries(imgs)) next[k] = makeTex(im);
      TEX = next;
      R = RIGS[l.ghost];
      prepareLimbs();
    }
    shimmer = l.style?.shimmer;
    glowRgb = shimmerRgb(shimmer, ghost(l.ghost).glow, T);
    setGradientColor(rgbCss(glowRgb));
    if (l.style?.aura !== cur.style?.aura || !loaded) aura.setId(l.style?.aura);
    if (l.style?.charm !== cur.style?.charm || !loaded) {
      setCharm(l.style?.charm);
      if (loaded && l.style?.charm) spinAt = T;
    }
    if (ghostChanged) charmFresh = true;
    cur = l;
    loaded = true;
    render();
  }
  const ready = apply(look).then(() => {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  });

  return {
    ready,
    setMode(m) {
      if (m === mode) return;
      if (mode === 'sleep' && m !== 'sleep') wideUntil = T + 0.6;
      // what he did at rest ends when he starts to focus or to sleep
      if (m !== 'idle') endAct();
      // he yawns before he falls asleep, if he has been up for a moment
      if (m === 'sleep' && mode === 'idle' && loaded && T > 2) startAct('yawn');
      mode = m;
    },
    setLevel(v, instant) {
      level = clamp(v, 0, 1);
      if (instant) {
        S.level.x = level;
        S.level.v = 0;
      }
    },
    setRing(p) {
      ringP = p;
    },
    setLook(l) {
      const ghostChanged = l.ghost !== cur.ghost;
      const styleChanged = l.style?.aura !== cur.style?.aura || l.style?.shimmer !== cur.style?.shimmer || l.style?.charm !== cur.style?.charm;
      if (!ghostChanged && !styleChanged) return;
      void apply(l).then(() => {
        if (ghostChanged) {
          S.squash.v -= 3;
          happyUntil = T + 0.8;
        } else {
          // a little shimmy and a puff of the new aura when the style changes
          S.squash.v -= 2.2;
          S.lean.v += 40;
          happyUntil = T + 0.6;
          aura.burst(auraBox(), 6);
        }
      });
    },
    celebrate,
    poke,
    wave() {
      waveUntil = T + 1.3;
    },
    greet() {
      if (mode !== 'idle') return;
      waveUntil = T + 2.3;
      wideUntil = T + 0.5;
      jump(300);
    },
    glance(clientX, clientY, seconds = 1.6) {
      if (mode !== 'idle') return;
      const p = toStage(clientX, clientY);
      glanceAt.x = p.x;
      glanceAt.y = p.y;
      glanceAt.until = T + seconds;
    },
    act(name) {
      queued = name;
    },
    setBond(l) {
      bond = l;
    },
    groundY() {
      // from the stage's own box, not from the last layout: the stage may have moved or grown since
      const r = host.getBoundingClientRect();
      const W = Math.max(1, r.width),
        H = Math.max(1, r.height);
      const mw = 440 / zoom,
        mh = 620 / zoom;
      const wide = W / H >= mw / mh;
      const vh = wide ? mh : (mw * H) / W;
      const upp = (wide ? (mh * W) / H : mw) / W;
      return r.top + (SHADOW_Y + shiftY - 310 + vh / 2) / upp;
    },
    destroy() {
      // a stroke or hold in progress ends with the stage (stops the purr)
      emit(gest.cancel(performance.now()));
      alive = false;
      offPlay();
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointerdown', onSee);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
      aura.clear();
      layer.remove();
    },
  };
}

/**
 * A still portrait of a ghost (for pickers, tiles and the share card). Returns a canvas.
 * Every ghost is framed the same way, so they read at the same size side by side; tall kits widen the frame.
 */
export async function renderPortrait(l: Pick<Look, 'ghost'>, size: number): Promise<HTMLCanvasElement> {
  const T = await preloadLook(l);
  const R = RIGS[l.ghost];
  const toStage = (u: number, v: number): Vec => [(u - R.cx) * R.k + 300, (v - R.cy) * R.k + 280];

  // every draw as: image, stage point, stage scale, rotation, anchor (image px, null = centre)
  type Op = { im: HTMLImageElement; p: Vec; s: number; deg: number; anchor: Vec | null };
  const ops: Op[] = [];
  const put = (name: string, u: number, v: number, s = 1, deg = 0, anchor: Vec | null = null) => {
    if (!T[name]) return;
    ops.push({ im: T[name], p: toStage(u, v), s: s * R.k, deg, anchor });
  };
  if (R.tuft) put('tuft', R.tuft.at[0], R.tuft.at[1], 1, R.tuft.rest, R.tuft.anchor);
  // an arm that lies behind the body comes first
  const arm = (name: 'arm_L' | 'arm_R', a: ArmRig, back: boolean) => {
    if (!!a.back === back) put(name, a.at[0], a.at[1], a.s, 0, a.anchor);
  };
  arm('arm_L', R.armL, true);
  arm('arm_R', R.armR, true);
  const b = T.body;
  put('body', b.naturalWidth / 2, b.naturalHeight / 2);
  put('blush_L', R.cx - R.blush[0], R.blush[1], R.blush[2]);
  put('blush_R', R.cx + R.blush[0], R.blush[1], R.blush[2]);
  if (R.eyes.includes('L')) put('eye_open_L', R.cx - R.eyeDX, R.eyeY, R.fs);
  if (R.eyes.includes('R')) put('eye_open_R', R.cx + R.eyeDX, R.eyeY, R.fs);
  put('mouth_smile', R.mouth[0], R.mouth[1], R.ms);
  arm('arm_L', R.armL, false);
  arm('arm_R', R.armR, false);

  // frame: the standard box, grown to fit what sticks out
  let x0 = 80,
    x1 = 520,
    y0 = 60,
    y1 = 500;
  for (const o of ops) {
    const w = o.im.naturalWidth * o.s,
      h = o.im.naturalHeight * o.s;
    const ax = o.anchor ? o.anchor[0] * o.s : w / 2,
      ay = o.anchor ? o.anchor[1] * o.s : h / 2;
    for (const [cx, cy] of [[-ax, -ay], [w - ax, -ay], [-ax, h - ay], [w - ax, h - ay]]) {
      const [rx, ry] = rot(o.deg, cx, cy);
      x0 = Math.min(x0, o.p[0] + rx);
      x1 = Math.max(x1, o.p[0] + rx);
      y0 = Math.min(y0, o.p[1] + ry);
      y1 = Math.max(y1, o.p[1] + ry);
    }
  }
  const half = Math.max(300 - x0, x1 - 300);
  const side = Math.max(2 * half, y1 - y0) * 1.03;
  const cyF = (y0 + y1) / 2;
  const sc = size / side;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  for (const o of ops) {
    ctx.save();
    ctx.translate((o.p[0] - (300 - side / 2)) * sc, (o.p[1] - (cyF - side / 2)) * sc);
    ctx.rotate(o.deg * RAD);
    const w = o.im.naturalWidth * o.s * sc,
      h = o.im.naturalHeight * o.s * sc;
    if (o.anchor) ctx.drawImage(o.im, -o.anchor[0] * o.s * sc, -o.anchor[1] * o.s * sc, w, h);
    else ctx.drawImage(o.im, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  return cv;
}
