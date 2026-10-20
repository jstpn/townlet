import { describe, expect, it } from 'vitest';
import { DIRS8, MAP_SIZE, idx, largestRegionSize } from '../src/sim/grid';
import { buildableFraction, generateMap } from '../src/sim/mapgen';
import { Terrain } from '../src/sim/types';

describe('generateMap', () => {
  it('is deterministic per seed and surrounded by water', () => {
    const a = generateMap('budapest');
    const b = generateMap('budapest');
    expect(a.terrain).toEqual(b.terrain);
    expect(a.terrain.length).toBe(MAP_SIZE * MAP_SIZE);
    for (let i = 0; i < MAP_SIZE; i++) {
      expect(a.terrain[idx(i, 0)]).toBe(Terrain.Water);
      expect(a.terrain[idx(i, MAP_SIZE - 1)]).toBe(Terrain.Water);
      expect(a.terrain[idx(0, i)]).toBe(Terrain.Water);
      expect(a.terrain[idx(MAP_SIZE - 1, i)]).toBe(Terrain.Water);
    }
    expect(generateMap('moonrise').terrain).not.toEqual(a.terrain);
  });
});

describe('generateMap land', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => `seed-${i}`);

  it('leaves at least 40% of tiles buildable for every seed', () => {
    for (const seed of seeds) {
      expect(buildableFraction(generateMap(seed).terrain), seed).toBeGreaterThanOrEqual(0.4);
    }
  });
});

describe('generateMap coast and forest', () => {
  it('rings every shore with sand and nothing else', () => {
    const { terrain } = generateMap('coast');
    for (let y = 1; y < MAP_SIZE - 1; y++) {
      for (let x = 1; x < MAP_SIZE - 1; x++) {
        const t = terrain[idx(x, y)];
        if (t === Terrain.Water) continue;
        const touchesWater = DIRS8.some(
          ([dx, dy]) => terrain[idx(x + dx, y + dy)] === Terrain.Water,
        );
        expect(t === Terrain.Sand, `tile ${x},${y}`).toBe(touchesWater);
      }
    }
  });
});

describe('generateMap forest', () => {
  it('plants forest on a reasonable share of the grass, never on sand', () => {
    for (const seed of ['oak', 'pine', 'birch', 'ash']) {
      const { terrain } = generateMap(seed);
      let land = 0;
      let forest = 0;
      for (const t of terrain) {
        if (t !== Terrain.Water) land++;
        if (t === Terrain.Forest) forest++;
      }
      expect(forest / land, seed).toBeGreaterThan(0.08);
      expect(forest / land, seed).toBeLessThan(0.45);
    }
  });
});

describe('generateMap water feature', () => {
  it('cuts a river or a lake into the interior', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const map = generateMap(`feature-${i}`);
      seen.add(map.feature);
      let interiorWater = 0;
      for (let y = 14; y < MAP_SIZE - 14; y++) {
        for (let x = 14; x < MAP_SIZE - 14; x++) {
          if (map.terrain[idx(x, y)] === Terrain.Water) interiorWater++;
        }
      }
      expect(interiorWater, `feature-${i}`).toBeGreaterThanOrEqual(25);
    }
    expect([...seen].sort()).toEqual(['lake', 'river']);
  });
});

describe('generateMap mainland', () => {
  it('keeps one connected land mass covering at least a third of the map', () => {
    for (let i = 0; i < 20; i++) {
      const { terrain } = generateMap(`mainland-${i}`);
      const size = largestRegionSize((tile) => terrain[tile] !== Terrain.Water);
      expect(size / terrain.length, `mainland-${i}`).toBeGreaterThanOrEqual(0.33);
    }
  });
});
