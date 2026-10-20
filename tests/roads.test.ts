import { describe, expect, it } from 'vitest';
import { idx } from '../src/sim/grid';
import { Sim } from '../src/sim/sim';
import { Terrain } from '../src/sim/types';
import { flatTerrain } from './helpers';

const newSim = (terrain = flatTerrain(Terrain.Grass)): Sim =>
  new Sim({ seed: 'test', difficulty: 'normal', terrain });

describe('roads', () => {
  it('places a road on grass and charges for it', () => {
    const sim = newSim();
    const before = sim.state.money;
    expect(sim.placeRoadLine(10, 10, 10, 10)).toEqual({ ok: true, cost: 10 });
    expect(sim.state.road[idx(10, 10)]).toBe(1);
    expect(sim.state.money).toBe(before - 10);
  });

  it('refuses water and reports why', () => {
    const sim = newSim(flatTerrain(Terrain.Water));
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
        { x: 2, y: 5, ok: true },
        { x: 3, y: 5, ok: false },
        { x: 4, y: 5, ok: true },
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
    const sim = new Sim({
      seed: 't',
      difficulty: 'normal',
      terrain: flatTerrain(Terrain.Grass),
      money: 25,
    });
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
