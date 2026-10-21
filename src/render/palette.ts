/** Every colour in the world is a named role, filled by one of four film palettes. */
export type Palette = {
  name: PaletteName;
  label: string;
  grass: string;
  grassAlt: string;
  sand: string;
  waterDeep: string;
  waterShallow: string;
  foliage: string;
  foliageAlt: string;
  trunk: string;
  road: string;
  roadLine: string;
  walls: readonly [string, string, string, string];
  roofs: readonly [string, string, string, string];
  trim: string;
  windowGlow: string;
  sky: string;
  fog: string;
  sun: string;
  night: string;
  accent: string;
  /** Undeveloped lot tints for residential, commercial and industrial zones. */
  zones: readonly [string, string, string];
};

export const PALETTE_NAMES = ['budapest', 'moonrise', 'darjeeling', 'asteroid'] as const;
export type PaletteName = (typeof PALETTE_NAMES)[number];

export const PALETTES: Record<PaletteName, Palette> = {
  budapest: {
    name: 'budapest',
    label: 'Budapest',
    grass: '#a8c08f',
    grassAlt: '#9eb785',
    sand: '#efd9b4',
    waterDeep: '#6f9fb8',
    waterShallow: '#a6cbd8',
    foliage: '#7f9e6e',
    foliageAlt: '#8fad7a',
    trunk: '#8b6a4e',
    road: '#5c5250',
    roadLine: '#e7dcc3',
    walls: ['#f2c6d0', '#f6e3d0', '#e9b5c4', '#f4ecd8'],
    roofs: ['#7a3b57', '#c4453a', '#5b3a5e', '#b2546c'],
    trim: '#f6eedc',
    windowGlow: '#ffd98a',
    sky: '#f4e7e1',
    fog: '#f1dfe0',
    sun: '#fff0d6',
    night: '#4a3b63',
    accent: '#c4453a',
    zones: ['#d9a8b6', '#8fb3c9', '#c9b27a'],
  },
  moonrise: {
    name: 'moonrise',
    label: 'Moonrise',
    grass: '#b3b067',
    grassAlt: '#a8a65e',
    sand: '#e7d39b',
    waterDeep: '#5f8d93',
    waterShallow: '#9cc1bd',
    foliage: '#7e8a4e',
    foliageAlt: '#8d9a55',
    trunk: '#7c5a3c',
    road: '#5a5245',
    roadLine: '#efe2bb',
    walls: ['#e8d8a8', '#d8a94a', '#f3e9cf', '#c9b47c'],
    roofs: ['#b5513c', '#4f7d7a', '#8a5a3a', '#6d6b3b'],
    trim: '#f3e9cf',
    windowGlow: '#ffd27a',
    sky: '#efe3c3',
    fog: '#ebdcb6',
    sun: '#fff0c4',
    night: '#3f4a55',
    accent: '#b5513c',
    zones: ['#d9b48a', '#8da79a', '#c2a26a'],
  },
  darjeeling: {
    name: 'darjeeling',
    label: 'Darjeeling',
    grass: '#a3b98c',
    grassAlt: '#98b082',
    sand: '#e8d7b1',
    waterDeep: '#3fa7a3',
    waterShallow: '#8fd0cb',
    foliage: '#6f9a7a',
    foliageAlt: '#7fa886',
    trunk: '#8a5f3f',
    road: '#58504a',
    roadLine: '#f0e4c8',
    walls: ['#f0dfb8', '#a9c8d8', '#e8c9a0', '#f6ecd6'],
    roofs: ['#7a2e2e', '#e9a13b', '#3f8f8c', '#a3552f'],
    trim: '#f6ecd6',
    windowGlow: '#ffd98a',
    sky: '#eae6d2',
    fog: '#dfe3d3',
    sun: '#fff2d0',
    night: '#2f4858',
    accent: '#e9a13b',
    zones: ['#d7a07c', '#7ea7a0', '#c7a85f'],
  },
  asteroid: {
    name: 'asteroid',
    label: 'Asteroid',
    grass: '#c9c08a',
    grassAlt: '#bfb680',
    sand: '#ecd3a8',
    waterDeep: '#6fc3c1',
    waterShallow: '#aee2df',
    foliage: '#9aa96a',
    foliageAlt: '#a9b874',
    trunk: '#9a6a48',
    road: '#6a5e52',
    roadLine: '#f4e6c8',
    walls: ['#f4c7a1', '#f8e4cc', '#b6e3c5', '#efd9b8'],
    roofs: ['#c4663c', '#5fb0ad', '#d9a05b', '#8c5a44'],
    trim: '#faf0dc',
    windowGlow: '#ffe0a0',
    sky: '#f6e2cf',
    fog: '#f2dcc8',
    sun: '#fff3d8',
    night: '#4a4a6a',
    accent: '#c4663c',
    zones: ['#d8b79a', '#9fb3a8', '#c0a97e'],
  },
};

export function isPaletteName(value: string): value is PaletteName {
  return (PALETTE_NAMES as readonly string[]).includes(value);
}
