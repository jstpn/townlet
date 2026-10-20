import { createNoise2D } from 'simplex-noise';
import {
  DIRS4,
  DIRS8,
  MAP_SIZE,
  TILE_COUNT,
  idx,
  inBounds,
  largestRegionSize,
  xOf,
  yOf,
} from './grid';
import { createRng, type Rng } from './rng';
import { Terrain } from './types';

export type WaterFeature = 'river' | 'lake';

export type GeneratedMap = {
  terrain: Uint8Array;
  feature: WaterFeature;
};

const MIN_BUILDABLE = 0.4;
const MIN_MAINLAND = 0.33;
const MAX_VARIANTS = 32;

type Noise2D = (x: number, y: number) => number;

/** Fractal noise in [-1, 1]. */
function fbm(noise: Noise2D, x: number, y: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  for (let octave = 0; octave < 4; octave++) {
    value += noise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / total;
}

function touchesWater(terrain: Uint8Array, x: number, y: number): boolean {
  for (const [dx, dy] of DIRS8) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(nx, ny) || terrain[idx(nx, ny)] === Terrain.Water) return true;
  }
  return false;
}

function generateVariant(seed: string, variant: number): GeneratedMap {
  const rng = createRng(`${seed}#${variant}`);
  const landNoise = createNoise2D(rng.next);
  const forestNoise = createNoise2D(rng.next);
  const feature: WaterFeature = rng.chance(0.5) ? 'river' : 'lake';
  const terrain = new Uint8Array(TILE_COUNT);
  const scale = 1 / 24;

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const nx = (x / (MAP_SIZE - 1)) * 2 - 1;
      const ny = (y / (MAP_SIZE - 1)) * 2 - 1;
      const edge = Math.max(Math.abs(nx), Math.abs(ny));
      const height = (fbm(landNoise, x * scale, y * scale) + 1) / 2;
      const land = height - 1.2 * edge ** 8 > 0.32 && edge < 0.94;
      terrain[idx(x, y)] = land ? Terrain.Grass : Terrain.Water;
    }
  }
  smooth(terrain);
  if (feature === 'river') carveRiver(terrain, rng);
  else digLake(terrain, rng);
  ringWithSand(terrain);
  plantForest(terrain, forestNoise);
  return { terrain, feature };
}

/** Majority filter over the 8-neighbourhood, so coasts lose single-tile specks. */
function smooth(terrain: Uint8Array): void {
  const before = Uint8Array.from(terrain);
  for (let y = 1; y < MAP_SIZE - 1; y++) {
    for (let x = 1; x < MAP_SIZE - 1; x++) {
      let land = before[idx(x, y)] === Terrain.Water ? 0 : 1;
      for (const [dx, dy] of DIRS8) {
        if (before[idx(x + dx, y + dy)] !== Terrain.Water) land++;
      }
      terrain[idx(x, y)] = land >= 5 ? Terrain.Grass : Terrain.Water;
    }
  }
}

/** A gently winding two-tile river straight across the map, so it meets the sea at both ends. */
export function carveRiver(terrain: Uint8Array, rng: Rng): void {
  const vertical = rng.chance(0.5);
  const centre = MAP_SIZE / 2 + rng.int(17) - 8;
  const amplitude = 4 + rng.int(5);
  const wavelength = 24 + rng.int(20);
  const phase = rng.next() * Math.PI * 2;
  for (let along = 0; along < MAP_SIZE; along++) {
    const offset = Math.round(
      centre + amplitude * Math.sin((along / wavelength) * Math.PI * 2 + phase),
    );
    for (let w = 0; w < 2; w++) {
      const across = offset + w;
      if (across < 0 || across >= MAP_SIZE) continue;
      terrain[vertical ? idx(across, along) : idx(along, across)] = Terrain.Water;
    }
  }
}

/** A lake with a noisy edge, dug somewhere on land in the middle of the map, always in one piece. */
export function digLake(terrain: Uint8Array, rng: Rng): void {
  const margin = 16;
  let cx = MAP_SIZE / 2;
  let cy = MAP_SIZE / 2;
  for (let attempt = 0; attempt < 20; attempt++) {
    const x = margin + rng.int(MAP_SIZE - margin * 2);
    const y = margin + rng.int(MAP_SIZE - margin * 2);
    if (terrain[idx(x, y)] !== Terrain.Water) {
      cx = x;
      cy = y;
      break;
    }
  }
  const radius = 4 + rng.int(3);
  const wobble = createNoise2D(rng.next);
  const candidate = new Uint8Array(TILE_COUNT);
  for (let y = cy - radius - 2; y <= cy + radius + 2; y++) {
    for (let x = cx - radius - 2; x <= cx + radius + 2; x++) {
      if (x < 1 || y < 1 || x >= MAP_SIZE - 1 || y >= MAP_SIZE - 1) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < radius * (1 + 0.3 * wobble(x / 4, y / 4))) candidate[idx(x, y)] = 1;
    }
  }
  // Keep only the part connected to the centre, so the wobble cannot leave stray ponds.
  const stack = [idx(cx, cy)];
  candidate[idx(cx, cy)] = 2;
  for (let tile = stack.pop(); tile !== undefined; tile = stack.pop()) {
    terrain[tile] = Terrain.Water;
    for (const [dx, dy] of DIRS4) {
      const next = idx(xOf(tile) + dx, yOf(tile) + dy);
      if (candidate[next] === 1) {
        candidate[next] = 2;
        stack.push(next);
      }
    }
  }
}

/** Land that touches water on any of its 8 sides becomes beach. */
function ringWithSand(terrain: Uint8Array): void {
  for (let y = 1; y < MAP_SIZE - 1; y++) {
    for (let x = 1; x < MAP_SIZE - 1; x++) {
      const tile = idx(x, y);
      if (terrain[tile] !== Terrain.Water && touchesWater(terrain, x, y)) {
        terrain[tile] = Terrain.Sand;
      }
    }
  }
}

/** Forest grows where a second noise layer runs high, only on grass. */
function plantForest(terrain: Uint8Array, noise: Noise2D): void {
  const scale = 1 / 9;
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const i = idx(x, y);
      if (terrain[i] !== Terrain.Grass) continue;
      if (fbm(noise, x * scale, y * scale) > 0.18) terrain[i] = Terrain.Forest;
    }
  }
}

/** Share of tiles that are not water. */
export function buildableFraction(terrain: Uint8Array): number {
  let buildable = 0;
  for (const t of terrain) {
    if (t !== Terrain.Water) buildable++;
  }
  return buildable / terrain.length;
}

export function generateMap(seed: string): GeneratedMap {
  let best = generateVariant(seed, 0);
  let bestFraction = buildableFraction(best.terrain);
  for (let variant = 0; variant < MAX_VARIANTS; variant++) {
    const candidate = variant === 0 ? best : generateVariant(seed, variant);
    const fraction = variant === 0 ? bestFraction : buildableFraction(candidate.terrain);
    const mainland = largestRegionSize((tile) => candidate.terrain[tile] !== Terrain.Water);
    if (fraction >= MIN_BUILDABLE && mainland / TILE_COUNT >= MIN_MAINLAND) return candidate;
    if (fraction > bestFraction) {
      best = candidate;
      bestFraction = fraction;
    }
  }
  // Every variant fell short; the fullest one is still a playable map.
  return best;
}
