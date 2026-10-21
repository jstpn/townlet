import { describe, expect, it } from 'vitest';
import { ROAD_E, ROAD_N, rampDirection, roadY } from '../src/render/roadMask';
import { STEP_Y } from '../src/render/ground';
import { DIRS4, MAP_SIZE, TILE_COUNT, idx, inBounds } from '../src/sim/grid';
import { generateMap } from '../src/sim/mapgen';
import { Terrain } from '../src/sim/types';
import { foundedSim } from './helpers';

describe('generateMap hills', () => {
  const seeds = [
    'budapest',
    'moonrise',
    'darjeeling',
    ...Array.from({ length: 12 }, (_, i) => `h-${i}`),
  ];

  it('raises terraces of at most two levels on grass and forest, never on water or sand', () => {
    for (const seed of seeds) {
      const { terrain, height } = generateMap(seed);
      expect(height.length).toBe(TILE_COUNT);
      let raised = 0;
      for (let tile = 0; tile < TILE_COUNT; tile++) {
        expect(height[tile]).toBeLessThanOrEqual(2);
        if (terrain[tile] === Terrain.Water || terrain[tile] === Terrain.Sand)
          expect(height[tile]).toBe(0);
        if (height[tile] > 0) raised++;
      }
      expect(raised).toBeGreaterThan(50);
    }
  });

  it('never steps more than one level between neighbours', () => {
    for (const seed of seeds) {
      const { height } = generateMap(seed);
      for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
          for (const [dx, dy] of DIRS4) {
            if (!inBounds(x + dx, y + dy)) continue;
            expect(Math.abs(height[idx(x, y)] - height[idx(x + dx, y + dy)])).toBeLessThanOrEqual(
              1,
            );
          }
        }
      }
    }
  });

  it('keeps the map itself unchanged from before hills existed', () => {
    const hash = (t: Uint8Array): number =>
      t.reduce((h, v, i) => (h * 31 + v * (i + 1)) % 2147483647, 7);
    expect(hash(generateMap('budapest').terrain)).toBe(1253293536);
    expect(hash(generateMap('moonrise').terrain)).toBe(2137560355);
  });
});

describe('services on hills', () => {
  it('need level ground for every tile of their footprint', () => {
    const sim = foundedSim();
    sim.state.height.fill(1, idx(10, 10), idx(10, 10) + 1);
    expect(sim.placeBuilding('school', 9, 9).ok).toBe(false);
    expect(sim.placeBuilding('school', 9, 9)).toEqual({ ok: false, reason: 'uneven' });
    expect(sim.placeBuilding('school', 11, 11).ok).toBe(true);
    expect(sim.placeBuilding('tree', 10, 10).ok).toBe(true);
  });
});

describe('road ramps', () => {
  it('ramps a straight road tile toward its one higher neighbour and interpolates its height', () => {
    const sim = foundedSim();
    sim.placeRoadLine(2, 5, 6, 5);
    const h = sim.state.height;
    h[idx(5, 5)] = 1;
    h[idx(6, 5)] = 1;
    const road = sim.state.road;
    expect(rampDirection(road, h, 4, 5)).toBe(ROAD_E);
    expect(rampDirection(road, h, 3, 5)).toBe(0);
    expect(rampDirection(road, h, 5, 5)).toBe(0);
    expect(roadY(road, h, 4.0, 5.5)).toBeCloseTo(0);
    expect(roadY(road, h, 4.5, 5.5)).toBeCloseTo(STEP_Y / 2);
    expect(roadY(road, h, 5.5, 5.5)).toBeCloseTo(STEP_Y);
    expect(roadY(road, h, 20.5, 20.5)).toBe(0);
  });

  it('does not ramp a junction or a tile with two higher neighbours', () => {
    const sim = foundedSim();
    sim.placeRoadLine(2, 5, 6, 5);
    sim.placeRoadLine(4, 5, 4, 7);
    const h = sim.state.height;
    h[idx(5, 5)] = 1;
    expect(rampDirection(sim.state.road, h, 4, 5)).toBe(0);
    h[idx(4, 6)] = 1;
    h[idx(5, 5)] = 0;
    h[idx(4, 4)] = 1;
    sim.placeRoadLine(4, 4, 4, 4);
    expect(rampDirection(sim.state.road, h, 4, 5)).toBe(0);
    for (const tile of [idx(4, 6), idx(3, 5), idx(5, 5)]) sim.state.road[tile] = 0;
    expect(rampDirection(sim.state.road, h, 4, 5)).toBe(ROAD_N);
  });
});
