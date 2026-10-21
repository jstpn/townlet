import { describe, expect, it } from 'vitest';
import { idx } from '../src/sim/grid';
import { Sim } from '../src/sim/sim';
import { Terrain } from '../src/sim/types';
import { flatTerrain } from './helpers';

const newSim = (terrain = flatTerrain(Terrain.Grass), money?: number): Sim => {
  const sim = new Sim({ seed: 'test', difficulty: 'normal', terrain, money });
  if (terrain[idx(30, 30)] !== Terrain.Water) sim.placeBuilding('townHall', 30, 30);
  return sim;
};

describe('roads', () => {
  it('places a road on grass and charges for it', () => {
    const sim = newSim();
    const before = sim.state.money;
    expect(sim.placeRoadLine(10, 10, 10, 10)).toEqual({ ok: true, cost: 10 });
    expect(sim.state.road[idx(10, 10)]).toBe(1);
    expect(sim.state.money).toBe(before - 10);
  });

  it('refuses water and reports why', () => {
    const terrain = flatTerrain(Terrain.Water);
    for (const t of [idx(30, 30), idx(31, 30), idx(30, 31), idx(31, 31)]) terrain[t] = Terrain.Grass;
    const sim = newSim(terrain);
    expect(sim.placeRoadLine(10, 10, 10, 10)).toEqual({ ok: false, reason: 'water' });
    expect(sim.state.road[idx(10, 10)]).toBe(0);
  });

  it('lays an axis-aligned line and charges only for new tiles', () => {
    const sim = newSim();
    expect(sim.placeRoadLine(2, 5, 6, 5)).toEqual({ ok: true, cost: 50 });
    expect(sim.placeRoadLine(4, 5, 4, 7)).toEqual({ ok: true, cost: 20 });
    for (let x = 2; x <= 6; x++) expect(sim.state.road[idx(x, 5)]).toBe(1);
    expect(sim.state.road[idx(4, 7)]).toBe(1);
  });

  it('snaps a diagonal drag onto the axis that moved most', () => {
    const sim = newSim();
    expect(sim.placeRoadLine(2, 5, 6, 8)).toEqual({ ok: true, cost: 50 });
    for (let x = 2; x <= 6; x++) expect(sim.state.road[idx(x, 5)]).toBe(1);
    expect(sim.state.road[idx(6, 8)]).toBe(0);
  });

  it('skips water tiles inside a line rather than failing the whole line', () => {
    const terrain = flatTerrain(Terrain.Grass);
    terrain[idx(4, 5)] = Terrain.Water;
    const sim = newSim(terrain);
    expect(sim.placeRoadLine(2, 5, 6, 5)).toEqual({ ok: true, cost: 40 });
    expect(sim.state.road[idx(4, 5)]).toBe(0);
  });

  it('previews a line with the tiles that will build and the price, without changing anything', () => {
    const terrain = flatTerrain(Terrain.Grass);
    terrain[idx(3, 5)] = Terrain.Water;
    const sim = newSim(terrain);
    const plan = sim.planRoadLine(2, 5, 4, 5);
    expect(plan).toEqual({
      tiles: [
        { x: 2, y: 5, status: 'change' },
        { x: 3, y: 5, status: 'blocked' },
        { x: 4, y: 5, status: 'change' },
      ],
      cost: 20,
    });
    expect(sim.state.road[idx(2, 5)]).toBe(0);
  });
});

describe('roads and the land', () => {
  it('clears forest for the bulldoze fee on top of the road price', () => {
    const terrain = flatTerrain(Terrain.Grass);
    terrain[idx(3, 3)] = Terrain.Forest;
    const sim = newSim(terrain);
    expect(sim.placeRoadLine(3, 3, 3, 3)).toEqual({ ok: true, cost: 12 });
    expect(sim.state.terrain[idx(3, 3)]).toBe(Terrain.Grass);
  });

  it('refuses when the town cannot afford it', () => {
    const sim = newSim(flatTerrain(Terrain.Grass), 25);
    expect(sim.placeRoadLine(0, 0, 0, 2)).toEqual({ ok: false, reason: 'insufficient-funds' });
    expect(sim.state.money).toBe(25);
  });

  it('bulldozes roads and forest in a rectangle for a fee per cleared tile', () => {
    const terrain = flatTerrain(Terrain.Grass);
    terrain[idx(6, 6)] = Terrain.Forest;
    const sim = newSim(terrain);
    sim.placeRoadLine(5, 5, 5, 6);
    const money = sim.state.money;
    expect(sim.bulldozeRect(5, 5, 6, 6)).toEqual({ ok: true, cost: 6 });
    expect(sim.state.road[idx(5, 5)]).toBe(0);
    expect(sim.state.road[idx(5, 6)]).toBe(0);
    expect(sim.state.terrain[idx(6, 6)]).toBe(Terrain.Grass);
    expect(sim.state.money).toBe(money - 6);
    expect(sim.bulldozeRect(5, 5, 6, 6)).toEqual({ ok: false, reason: 'nothing-to-build' });
  });
});

describe('revision counters', () => {
  it('bump roads once per road command and terrain only when forest is cleared', () => {
    const terrain = flatTerrain(Terrain.Grass);
    terrain[idx(8, 5)] = Terrain.Forest;
    const sim = newSim(terrain);
    const before = { ...sim.state.rev };
    sim.placeRoadLine(2, 5, 6, 5);
    expect(sim.state.rev.roads).toBeGreaterThan(before.roads);
    expect(sim.state.rev.terrain).toBe(before.terrain);
    const afterFirst = { ...sim.state.rev };
    sim.placeRoadLine(4, 5, 8, 5);
    expect(sim.state.rev.roads).toBeGreaterThan(afterFirst.roads);
    expect(sim.state.rev.terrain).toBeGreaterThan(afterFirst.terrain);
  });

  it('stay put when a command is refused', () => {
    const terrain = flatTerrain(Terrain.Water);
    for (const t of [idx(30, 30), idx(31, 30), idx(30, 31), idx(31, 31)]) terrain[t] = Terrain.Grass;
    const sim = newSim(terrain);
    const before = { ...sim.state.rev };
    sim.placeRoadLine(2, 5, 6, 5);
    sim.bulldozeRect(2, 5, 6, 5);
    expect(sim.state.rev).toEqual(before);
  });

  it('mark existing road as kept, so a repeated line changes nothing and bumps nothing', () => {
    const sim = newSim();
    sim.placeRoadLine(2, 5, 6, 5);
    const rev = { ...sim.state.rev };
    const plan = sim.planRoadLine(2, 5, 6, 5);
    expect(plan.error).toBe('nothing-to-build');
    expect(plan.tiles.every((t) => t.status === 'keep')).toBe(true);
    sim.placeRoadLine(2, 5, 6, 5);
    expect(sim.state.rev).toEqual(rev);
  });
});

describe('difficulty', () => {
  it('sets the starting money and scales prices with rounding', () => {
    const grass = flatTerrain(Terrain.Grass);
    const easy = new Sim({ seed: 't', difficulty: 'easy', terrain: grass });
    const hard = new Sim({ seed: 't', difficulty: 'hard', terrain: grass });
    expect(easy.state.money).toBe(20000);
    expect(hard.state.money).toBe(6000);
    easy.placeBuilding('townHall', 30, 30);
    hard.placeBuilding('townHall', 30, 30);
    expect(easy.placeRoadLine(1, 1, 1, 1)).toEqual({ ok: true, cost: 8 });
    expect(hard.placeRoadLine(1, 1, 1, 1)).toEqual({ ok: true, cost: 13 });
    expect(hard.bulldozeRect(1, 1, 1, 1)).toEqual({ ok: true, cost: 3 });
  });
});
