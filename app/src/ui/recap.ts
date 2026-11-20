/** The monthly share card, drawn offline on a canvas (1080 x 1350, a 4:5 post). */
import { RARITY_COLOR, charmImg, ghost, style } from '../data/catalog';
import { rgbCss, shimmerRgb } from '../fx/shimmer';
import { fmtDate, fmtNum, t } from '../i18n';
import { CHARGE_DAY_MIN, minutesByDay } from '../logic/progress';
import { monthDays, monthKey } from '../logic/time';
import { loadImage, renderPortrait } from '../rig/rig';
import { companionName, now } from '../state/store';
import type { State } from '../state/store';

export interface MonthStats {
  label: string;
  minutes: number;
  sessions: number;
  days: number;
  /** Styles and ghosts that came this month, newest first. */
  finds: { kind: 'style' | 'ghost'; id: string }[];
}

export function monthStats(s: State, at = now()): MonthStats {
  const mk = monthKey(at);
  const days = new Set(monthDays(at));
  const sess = s.sessions.filter((x) => days.has(x.day));
  const byDay = minutesByDay(sess);
  const finds = [
    ...Object.entries(s.ghosts).map(([id, r]) => ({ kind: 'ghost' as const, id, at: r.at, via: r.via })),
    ...Object.entries(s.styles).map(([id, r]) => ({ kind: 'style' as const, id, at: r.at, via: r.via })),
  ]
    .filter((f) => monthKey(f.at) === mk && f.via !== 'start')
    .sort((a, b) => b.at - a.at)
    .map(({ kind, id }) => ({ kind, id }));
  return {
    label: fmtDate(at, { month: 'long' }),
    minutes: sess.reduce((a, x) => a + x.min, 0),
    sessions: sess.length,
    days: [...byDay.values()].filter((m) => m >= CHARGE_DAY_MIN).length,
    finds,
  };
}

/** A style as a round glowing badge for the share card; a charm shows its picture on the glow. */
function styleBadge(id: string, size: number, img?: HTMLImageElement): HTMLCanvasElement {
  const x = style(id);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const c = size / 2;
  const col = x.kind === 'shimmer' ? rgbCss(shimmerRgb(id, RARITY_COLOR[x.rarity], 1.3)) : RARITY_COLOR[x.rarity];
  const g = ctx.createRadialGradient(c, c, 4, c, c, c);
  g.addColorStop(0, col);
  g.addColorStop(0.45, col);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = x.kind === 'shimmer' ? 0.9 : 0.55;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (img) {
    const k = (size * 0.66) / Math.max(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth * k,
      h = img.naturalHeight * k;
    ctx.drawImage(img, c - w / 2, c - h / 2, w, h);
  }
  // a few sparkles around an aura
  if (x.kind === 'aura') {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + id.length;
      const r = c * (0.45 + 0.35 * ((i * 37) % 10) / 10);
      ctx.globalAlpha = 0.6 + 0.4 * ((i * 53) % 10) / 10;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, size * (0.02 + 0.015 * (i % 3)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  return cv;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderRecap(s: State): Promise<HTMLCanvasElement> {
  const W = 1080,
    H = 1350;
  const m = monthStats(s);
  const glowC = ghost(s.companion).glow;
  await Promise.all([document.fonts.load('600 80px Fredoka'), document.fonts.load('800 40px Nunito'), document.fonts.load('700 30px Nunito')]);
  const portrait = await renderPortrait({ ghost: s.companion }, 520);
  const shown = m.finds.slice(0, 5);
  const imgs: CanvasImageSource[] = await Promise.all(
    shown.map((f) =>
      f.kind === 'ghost'
        ? renderPortrait({ ghost: f.id }, 300)
        : style(f.id).kind === 'charm'
          ? loadImage(charmImg(f.id)).then((img) => styleBadge(f.id, 300, img))
          : Promise.resolve(styleBadge(f.id, 300)),
    ),
  );

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;

  // night sky
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2b2366');
  bg.addColorStop(0.5, '#18143d');
  bg.addColorStop(1, '#0d0a22');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 120; i++) {
    ctx.globalAlpha = 0.25 + rnd() * 0.6;
    ctx.fillStyle = '#d8deff';
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H * 0.8, 1 + rnd() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // glow + companion
  const glow = ctx.createRadialGradient(W / 2, 470, 20, W / 2, 470, 380);
  glow.addColorStop(0, glowC + '88');
  glow.addColorStop(1, glowC + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 60, W, 820);
  ctx.drawImage(portrait, W / 2 - 260, 210, 520, 520);

  // header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5be3ff';
  ctx.font = '800 34px Nunito';
  ctx.fillText('⚡ CHARGEGEIST', W / 2, 96);
  ctx.fillStyle = '#f3f1ff';
  ctx.font = '600 70px Fredoka';
  ctx.fillText(t('recap_title', { month: m.label }), W / 2, 176);

  // stats
  const stats: [string, string][] = [
    [fmtNum(Math.round((m.minutes / 60) * 10) / 10), t('recap_hours')],
    [fmtNum(m.sessions), t('recap_sessions')],
    [fmtNum(m.finds.length), t('recap_ghosts')],
    [fmtNum(m.days), t('recap_days')],
  ];
  const bw = 228,
    bh = 170,
    gap = 20,
    x0 = (W - (bw * 4 + gap * 3)) / 2,
    y0 = 770;
  stats.forEach(([v, l], i) => {
    const x = x0 + i * (bw + gap);
    ctx.fillStyle = 'rgba(29,25,56,.82)';
    rr(ctx, x, y0, bw, bh, 30);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,180,255,.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = i === 0 ? '#5be3ff' : '#f3f1ff';
    ctx.font = '600 66px Fredoka';
    ctx.fillText(v, x + bw / 2, y0 + 88);
    ctx.fillStyle = '#a7a1cb';
    ctx.font = '700 25px Nunito';
    ctx.fillText(l, x + bw / 2, y0 + 132);
  });

  // ghosts of the month
  if (imgs.length) {
    const size = 150,
      gw = imgs.length * size + (imgs.length - 1) * 18,
      gx = (W - gw) / 2,
      gy = 985;
    imgs.forEach((im, i) => {
      const iw = (im as HTMLImageElement | HTMLCanvasElement).width,
        ih = (im as HTMLImageElement | HTMLCanvasElement).height;
      const k = Math.min(size / iw, size / ih);
      const w = iw * k,
        h = ih * k;
      ctx.drawImage(im, gx + i * (size + 18) + (size - w) / 2, gy + (size - h) / 2, w, h);
    });
  }

  ctx.fillStyle = '#a7a1cb';
  ctx.font = '700 28px Nunito';
  ctx.fillText(`${companionName(s)} · ${t('recap_footer')}`, W / 2, H - 70);
  return cv;
}
