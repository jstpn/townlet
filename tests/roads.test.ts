import { describe, expect, it } from 'vitest';
import { idx } from '../src/sim/grid';
import { flatTerrain } from '../src/sim/mapgen';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, roadConnections } from '../src/sim/roads';
import { Sim } from '../src/sim/sim';
import { Terrain } from '../src/sim/types';

const newSim = (terrain = flatTerrain(Terrain.Grass)): Sim =>
  new Sim({ seed: 'test', difficulty: 'normal', terrain });

describe('roads', () => {
  it('places a road on grass and charges for it', () => {
    const sim = newSim();
    const before = sim.state.money;
    const result = sim.placeRoad(10, 10);
    expect(result).toEqual({ ok: true, cost: 10 });
    expect(sim.state.road[idx(10, 10)]).toBe(1);
    expect(sim.state.money).toBe(before - 10);
  });
});

describe('road lines', () => {
  it('refuses water and reports why', () => {
    const sim = newSim(flatTerrain(Terrain.Water));
    expect(sim.placeRoad(10, 10)).toEqual({ ok: false, reason: 'water' });
    expect(sim.state.road[idx(10, 10)]).toBe(0);
  });

  it('lays an axis-aligned line and charges only for new tiles', () => {
    const sim = newSim();
    expect(sim.placeRoadLine(2, 5, 6, 5)).toEqual({ ok: true, cost: 50 });
    expect(sim.placeRoadLine(4, 5, 4, 7)).toEqual({ ok: true, cost: 20 });
    for (let x = 2; x <= 6; x++) expect(sim.state.road[idx(x, 5)]).toBe(1);
    expect(sim.state.road[idx(4, 7)]).toBe(1);
  });

  it('rejects a diagonal line', () => {
    const sim = newSim();
    expect(sim.placeRoadLine(2, 5, 6, 8)).toEqual({ ok: false, reason: 'not-a-line' });
  });

  it('skips water tiles inside a line rather than failing the whole line', () => {
    const terrain = flatTerrain(Terrain.Grass);
    terrain[idx(4, 5)] = Terrain.Water;
    const sim = newSim(terrain);
    expect(sim.placeRoadLine(2, 5, 6, 5)).toEqual({ ok: true, cost: 40 });
    expect(sim.state.road[idx(4, 5)]).toBe(0);
  });
});

describe('roads and the land', () => {
  it('clears forest for the bulldoze fee on top of the road price', () => {
    const terrain = flatTerrain(Terrain.Grass);
    terrain[idx(3, 3)] = Terrain.Forest;
    const sim = newSim(terrain);
    expect(sim.placeRoad(3, 3)).toEqual({ ok: true, cost: 12 });
    expect(sim.state.terrain[idx(3, 3)]).toBe(Terrain.Grass);
  });

  it('refuses when the town cannot afford it', () => {
    const sim = new Sim({ seed: 't', difficulty: 'normal', terrain: flatTerrain(Terrain.Grass), money: 25 });
    expect(sim.placeRoadLine(0, 0, 0, 2)).toEqual({ ok: false, reason: 'insufficient-funds' });
    expect(sim.state.money).toBe(25);
  });

  it('bulldozes a road for a small fee', () => {
    const sim = newSim();
    sim.placeRoad(5, 5);
    const money = sim.state.money;
    expect(sim.bulldoze(5, 5)).toEqual({ ok: true, cost: 2 });
    expect(sim.state.road[idx(5, 5)]).toBe(0);
    expect(sim.state.money).toBe(money - 2);
    expect(sim.bulldoze(5, 5)).toEqual({ ok: false, reason: 'nothing-to-build' });
  });
});

describe('road connections', () => {
  it('reports which neighbours a road tile joins, as N E S W bits', () => {
    const sim = newSim();
    sim.placeRoadLine(2, 5, 6, 5);
    sim.placeRoadLine(4, 5, 4, 7);
    expect(roadConnections(sim.state.road, 3, 5)).toBe(ROAD_E | ROAD_W);
    expect(roadConnections(sim.state.road, 4, 5)).toBe(ROAD_E | ROAD_W | ROAD_S);
    expect(roadConnections(sim.state.road, 2, 5)).toBe(ROAD_E);
    expect(roadConnections(sim.state.road, 4, 7)).toBe(ROAD_N);
    expect(roadConnections(sim.state.road, 0, 0)).toBe(0);
  });
});
