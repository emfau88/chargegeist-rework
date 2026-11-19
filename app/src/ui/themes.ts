import type { ThemeId } from '../state/store';

export interface ThemeDef {
  id: ThemeId;
  plus: boolean;
  /** Background image, if any. */
  img?: string;
  /** CSS background behind (or instead of) the image. */
  css: string;
  /** Dark veil over images so text stays readable. */
  veil: string;
  stars: boolean;
}

const base = import.meta.env.BASE_URL;

export const THEMES: ThemeDef[] = [
  {
    id: 'night',
    plus: false,
    css: 'radial-gradient(70% 45% at 50% 30%, rgba(91,227,255,.10), transparent 70%), radial-gradient(120% 80% at 50% 0%, #2b2366 0%, #18143d 45%, #0d0a22 100%)',
    veil: 'transparent',
    stars: true,
  },
  {
    id: 'cozynight',
    plus: true,
    img: `${base}assets/themes/cozynight.webp`,
    css: '#2a1a28',
    veil: 'linear-gradient(180deg, rgba(12,9,26,.35), rgba(12,9,26,.15) 40%, rgba(12,9,26,.7))',
    stars: false,
  },
  {
    id: 'forestglow',
    plus: true,
    img: `${base}assets/themes/forestglow.webp`,
    css: '#1c2a14',
    veil: 'linear-gradient(180deg, rgba(10,16,10,.55), rgba(10,16,10,.35) 40%, rgba(8,12,10,.8))',
    stars: false,
  },
  {
    id: 'cottonsky',
    plus: true,
    img: `${base}assets/themes/main.webp`,
    css: '#8d7fd6',
    veil: 'linear-gradient(180deg, rgba(30,20,70,.55), rgba(30,20,70,.35) 40%, rgba(22,16,52,.82))',
    stars: false,
  },
  {
    id: 'mysticpurple',
    plus: true,
    img: `${base}assets/themes/mysticpurple.webp`,
    css: '#24123d',
    veil: 'linear-gradient(180deg, rgba(14,8,30,.2), transparent 40%, rgba(14,8,30,.6))',
    stars: false,
  },
  {
    id: 'aurora',
    plus: true,
    css: 'radial-gradient(60% 30% at 30% 18%, rgba(110,255,200,.32), transparent 70%), radial-gradient(55% 28% at 75% 26%, rgba(120,170,255,.30), transparent 70%), radial-gradient(70% 40% at 50% 8%, rgba(200,120,255,.22), transparent 70%), linear-gradient(180deg, #0b1d2c 0%, #0b1426 55%, #070b18 100%)',
    veil: 'transparent',
    stars: true,
  },
  {
    id: 'dusk',
    plus: true,
    css: 'radial-gradient(80% 45% at 50% 110%, rgba(255,140,90,.45), transparent 70%), radial-gradient(60% 40% at 80% 0%, rgba(255,110,150,.25), transparent 70%), linear-gradient(180deg, #2a1640 0%, #3d1b3f 45%, #5a2a3a 80%, #6e3330 100%)',
    veil: 'transparent',
    stars: true,
  },
];

export function theme(id: ThemeId): ThemeDef {
  return THEMES.find((x) => x.id === id) ?? THEMES[0];
}
