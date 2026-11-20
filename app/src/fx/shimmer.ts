/**
 * Shimmers: the colour of a ghost's glow, charge fill, charge ring and sparks.
 * A shimmer never changes the ghost's own art. Some shimmers move (pulse or shift their hue).
 */
export type Rgb = [number, number, number];

function hex(h: string): Rgb {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function hsl(h: number, s: number, l: number): Rgb {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}
function mix(a: Rgb, b: Rgb, k: number): Rgb {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

const STATIC: Record<string, string> = {
  shimmer_moon: '#dce8ff',
  shimmer_mint: '#6dffc4',
  shimmer_gold: '#ffc63f',
  shimmer_rose: '#ff94c6',
};

/** Shimmers whose colour changes over time. */
export function shimmerMoves(id: string | undefined): boolean {
  return !!id && !STATIC[id] && id.startsWith('shimmer_');
}

/** The glow colour at time t (seconds). Without a shimmer it is the ghost's own glow. */
export function shimmerRgb(id: string | undefined, base: string, t: number): Rgb {
  if (!id) return hex(base);
  if (STATIC[id]) return hex(STATIC[id]);
  switch (id) {
    case 'shimmer_ember': {
      // a slow, uneven ember pulse
      const k = 0.5 + 0.5 * Math.sin(t * 2.1) * (0.7 + 0.3 * Math.sin(t * 5.3));
      return mix(hex('#ff5a2c'), hex('#ffbb4d'), k);
    }
    case 'shimmer_rainbow':
      return hsl(t * 45, 0.9, 0.66);
    case 'shimmer_aurora':
      return hsl(205 + Math.sin(t * 0.55) * 60 + Math.sin(t * 1.3) * 18, 0.85, 0.62);
    case 'shimmer_holo':
      return hsl(t * 110, 1, 0.8);
    case 'shimmer_heart': {
      // a heartbeat: two quick beats, then rest
      const p = (t * 1.1) % 1;
      const beat = Math.exp(-((p - 0.1) ** 2) / 0.003) + 0.7 * Math.exp(-((p - 0.32) ** 2) / 0.003);
      return mix(hex('#ff5f9e'), hex('#ffc2dc'), Math.min(1, beat));
    }
  }
  return hex(base);
}

export function rgbCss(c: Rgb): string {
  return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
}

/** A CSS gradient that stands for a shimmer on cards and tiles. */
export function shimmerSwatch(id: string): string {
  if (STATIC[id]) return STATIC[id];
  const steps = id === 'shimmer_holo' || id === 'shimmer_rainbow' ? 6 : 4;
  const span = id === 'shimmer_holo' ? 1 / 110 * 360 : id === 'shimmer_rainbow' ? 8 : id === 'shimmer_aurora' ? 5.7 : 3;
  const stops = Array.from({ length: steps }, (_, i) => rgbCss(shimmerRgb(id, '#ffffff', (i / (steps - 1)) * span)));
  return `linear-gradient(135deg, ${stops.join(', ')})`;
}
