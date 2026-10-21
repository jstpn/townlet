import { beforeEach, describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_VERSION, type SaveFile, readSave } from '../src/save';
import { idx } from '../src/sim/grid';
import { Terrain } from '../src/sim/types';
import { PALETTE_NAMES } from '../src/render/palette';
import { type SimSnapshot, restoreSim, snapshot } from '../src/sim/save';
import { Sim } from '../src/sim/sim';
import { days, foundedSim } from './helpers';

function builtTown(): Sim {
  const sim = foundedSim({});
  sim.placeRoadLine(20, 33, 44, 33);
  sim.placeBuilding('windTurbine', 25, 28);
  sim.placeBuilding('waterTower', 35, 28);
  sim.zoneRect(1, 22, 34, 30, 34);
  sim.zoneRect(2, 31, 34, 36, 34);
  sim.zoneRect(3, 37, 34, 42, 34);
  days(sim, 95);
  return sim;
}

describe('save', () => {
  it('round-trips through a plain object and keeps simulating identically', () => {
    const original = builtTown();
    const snap = JSON.parse(JSON.stringify(snapshot(original))) as ReturnType<typeof snapshot>;
    const restored = restoreSim(snap);
    expect(restored.state.day).toBe(original.state.day);
    expect(restored.state.population).toBe(original.state.population);
    expect(restored.state.buildings.size).toBe(original.state.buildings.size);
    expect(restored.state.level).toEqual(original.state.level);
    days(original, 70);
    days(restored, 70);
    expect(restored.state.population).toBe(original.state.population);
    expect(restored.state.money).toBe(original.state.money);
    expect(restored.state.level).toEqual(original.state.level);
    expect(restored.state.occupancy).toEqual(original.state.occupancy);
  });

  it('restores an unfounded town with nothing built', () => {
    const sim = new Sim({ seed: 'fresh', difficulty: 'hard' });
    const restored = restoreSim(snapshot(sim));
    expect(restored.state.founded).toBe(false);
    expect(restored.state.difficulty).toBe('hard');
    expect(restored.state.terrain).toEqual(sim.state.terrain);
  });
});

describe('snapshots', () => {
  it('share nothing mutable with the sim they came from or the sim they make', () => {
    const sim = foundedSim({ age: 'forager' });
    sim.placeRoadLine(20, 33, 44, 33);
    sim.state.population = 2;
    sim.startResearch('fire');
    const snap = snapshot(sim);
    const restored = restoreSim(snap);
    days(sim, 3);
    expect(snap.stock).toEqual({ food: 15, wood: 0, stone: 10 });
    expect(snap.research).toEqual({ id: 'fire', daysLeft: 30 });
    expect(restored.state.stock).toEqual(snap.stock);
    expect(restored.state.research).toEqual(snap.research);
    days(restored, 1);
    expect(snap.buildings[0].workers).toBe(0);
    expect(sim.state.research?.daysLeft).toBe(27);
  });
});

describe('a forager town', () => {
  it('round-trips mid-research through JSON and keeps simulating identically', () => {
    const original = foundedSim({ age: 'forager' });
    original.placeRoadLine(20, 33, 44, 33);
    original.state.terrain[idx(37, 34)] = Terrain.Forest;
    original.placeBuilding('gatheringHut', 34, 34);
    original.state.stock = { food: 60, wood: 40, stone: 40 };
    original.startResearch('fire');
    days(original, 30);
    original.state.stock.stone = 40;
    original.startResearch('grindingStones');
    days(original, 12);
    const restored = restoreSim(JSON.parse(JSON.stringify(snapshot(original))) as SimSnapshot);
    expect(restored.state.age).toBe('forager');
    expect([...restored.state.held]).toEqual(['fire']);
    expect(restored.state.research).toEqual({ id: 'grindingStones', daysLeft: 18 });
    for (const sim of [original, restored]) days(sim, 40);
    expect(restored.state.population).toBe(original.state.population);
    expect(restored.state.population).toBeGreaterThan(1);
    expect(restored.state.stock).toEqual(original.state.stock);
    expect([...restored.state.held]).toEqual(['fire', 'grindingStones']);
    expect([...restored.state.buildings.values()]).toEqual([...original.state.buildings.values()]);
  });
});

describe('the save file', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    } as unknown as Storage;
  });
  const file = (): SaveFile => ({
    version: SAVE_VERSION,
    sim: snapshot(foundedSim({ age: 'forager' })),
    palette: PALETTE_NAMES[0],
    camera: { target: { x: 0, z: 0 }, zoom: 1, turn: 0 } as unknown as SaveFile['camera'],
  });

  it('reads back a version 3 save', () => {
    expect(SAVE_VERSION).toBe(3);
    store.set(SAVE_KEY, JSON.stringify(file()));
    expect(readSave()?.sim.age).toBe('forager');
  });

  it('ignores a version 2 save and a save without a stock', () => {
    store.set(SAVE_KEY, JSON.stringify({ ...file(), version: 2 }));
    expect(readSave()).toBeUndefined();
    const stockless = file() as unknown as { sim: Record<string, unknown> };
    delete stockless.sim.stock;
    store.set(SAVE_KEY, JSON.stringify(stockless));
    expect(readSave()).toBeUndefined();
  });
});
