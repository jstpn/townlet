import { describe, expect, it } from 'vitest';
import { idx } from '../src/sim/grid';
import { Sim } from '../src/sim/sim';
import { Terrain, Zone } from '../src/sim/types';
import { flatTerrain, foundedSim } from './helpers';

const founded = (terrain?: Uint8Array): Sim => foundedSim({ terrain });

describe('zoning', () => {
  it('paints a rectangle of residential zone and charges per tile', () => {
    const sim = founded();
    const money = sim.state.money;
    expect(sim.zoneRect(Zone.Residential, 2, 2, 4, 3)).toEqual({ ok: true, cost: 30 });
    expect(sim.state.zone[idx(2, 2)]).toBe(Zone.Residential);
    expect(sim.state.zone[idx(4, 3)]).toBe(Zone.Residential);
    expect(sim.state.zone[idx(5, 3)]).toBe(Zone.None);
    expect(sim.state.money).toBe(money - 30);
  });
});

describe('founding the town', () => {
  it('requires the town hall before anything else', () => {
    const sim = new Sim({
      seed: 'test',
      difficulty: 'normal',
      terrain: flatTerrain(Terrain.Grass),
    });
    expect(sim.zoneRect(Zone.Residential, 2, 2, 4, 3)).toEqual({
      ok: false,
      reason: 'needs-town-hall',
    });
    expect(sim.placeRoadLine(0, 0, 0, 2)).toEqual({ ok: false, reason: 'needs-town-hall' });
    expect(sim.placeBuilding('park', 5, 5)).toEqual({ ok: false, reason: 'needs-town-hall' });
    expect(sim.placeBuilding('townHall', 30, 30)).toEqual({ ok: true, cost: 0 });
    expect(sim.placeBuilding('park', 5, 5)).toEqual({ ok: true, cost: 100 });
  });

  it('allows exactly one town hall and it occupies a 2x2 footprint', () => {
    const sim = founded();
    const id = sim.state.buildingId[idx(30, 30)];
    expect(id).toBeGreaterThan(0);
    expect(sim.state.buildingId[idx(31, 31)]).toBe(id);
    expect(sim.state.buildingId[idx(32, 30)]).toBe(-1);
    expect(sim.state.buildings.get(id)?.kind).toBe('townHall');
    expect(sim.placeBuilding('townHall', 10, 10)).toEqual({ ok: false, reason: 'already-built' });
  });

  it('cannot bulldoze the town hall', () => {
    const sim = founded();
    expect(sim.bulldozeRect(30, 30, 31, 31)).toEqual({ ok: false, reason: 'protected' });
    expect(sim.state.buildings.size).toBe(1);
  });
});

describe('placing buildings', () => {
  it('refuses water, roads, other buildings and the map edge', () => {
    const terrain = flatTerrain(Terrain.Grass);
    terrain[idx(5, 5)] = Terrain.Water;
    const sim = founded(terrain);
    sim.placeRoadLine(8, 8, 8, 8);
    expect(sim.placeBuilding('park', 5, 5)).toEqual({ ok: false, reason: 'occupied' });
    expect(sim.placeBuilding('park', 8, 8)).toEqual({ ok: false, reason: 'occupied' });
    expect(sim.placeBuilding('park', 30, 31)).toEqual({ ok: false, reason: 'occupied' });
    expect(sim.placeBuilding('school', 63, 63)).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(sim.placeBuilding('school', 61, 61)).toEqual({ ok: true, cost: 400 });
  });

  it('clears forest for a fee and replaces undeveloped zone paint', () => {
    const terrain = flatTerrain(Terrain.Grass);
    terrain[idx(5, 5)] = Terrain.Forest;
    const sim = founded(terrain);
    sim.zoneRect(Zone.Commercial, 6, 5, 6, 7);
    expect(sim.placeBuilding('school', 5, 5)).toEqual({ ok: true, cost: 402 });
    expect(sim.state.terrain[idx(5, 5)]).toBe(Terrain.Grass);
    expect(sim.state.zone[idx(6, 5)]).toBe(Zone.None);
    expect(sim.state.zone[idx(6, 7)]).toBe(Zone.Commercial);
  });

  it('bulldozes a whole building from any of its tiles', () => {
    const sim = founded();
    sim.placeBuilding('school', 10, 10);
    const money = sim.state.money;
    expect(sim.bulldozeRect(11, 11, 11, 11)).toEqual({ ok: true, cost: 8 });
    expect(sim.state.buildingId[idx(10, 10)]).toBe(-1);
    expect(sim.state.buildings.size).toBe(1);
    expect(sim.state.money).toBe(money - 8);
  });
});

describe('zoning rules', () => {
  it('skips water, roads and buildings and keeps same-zone tiles free', () => {
    const terrain = flatTerrain(Terrain.Grass);
    terrain[idx(2, 2)] = Terrain.Water;
    const sim = founded(terrain);
    sim.placeRoadLine(3, 2, 3, 2);
    sim.zoneRect(Zone.Residential, 4, 2, 4, 2);
    const plan = sim.planZoneRect(Zone.Residential, 2, 2, 5, 2);
    expect(plan.tiles.map((t) => t.status)).toEqual(['blocked', 'blocked', 'keep', 'change']);
    expect(plan.cost).toBe(5);
  });

  it('repaints empty lots but not developed ones', () => {
    const sim = founded();
    sim.zoneRect(Zone.Residential, 2, 2, 3, 2);
    sim.state.level[idx(3, 2)] = 1;
    const plan = sim.planZoneRect(Zone.Commercial, 2, 2, 3, 2);
    expect(plan.tiles.map((t) => t.status)).toEqual(['change', 'blocked']);
    expect(sim.zoneRect(Zone.Commercial, 2, 2, 3, 2)).toEqual({ ok: true, cost: 5 });
    expect(sim.state.zone[idx(2, 2)]).toBe(Zone.Commercial);
    expect(sim.state.zone[idx(3, 2)]).toBe(Zone.Residential);
  });

  it('bulldozes zone paint and development', () => {
    const sim = founded();
    sim.zoneRect(Zone.Industrial, 2, 2, 3, 2);
    sim.state.level[idx(2, 2)] = 2;
    expect(sim.bulldozeRect(2, 2, 3, 2)).toEqual({ ok: true, cost: 4 });
    expect(sim.state.zone[idx(2, 2)]).toBe(Zone.None);
    expect(sim.state.level[idx(2, 2)]).toBe(0);
  });

  it('roads overwrite zone paint', () => {
    const sim = founded();
    sim.zoneRect(Zone.Residential, 2, 2, 2, 4);
    const before = sim.state.rev.zones;
    sim.placeRoadLine(2, 2, 2, 4);
    expect(sim.state.zone[idx(2, 3)]).toBe(Zone.None);
    expect(sim.state.rev.zones).toBeGreaterThan(before);
  });
});

describe('roads and lots', () => {
  it('refuses to pave over developed lots and names buildings, not water, when blocked', () => {
    const sim = founded();
    sim.zoneRect(Zone.Residential, 2, 2, 2, 2);
    sim.state.level[idx(2, 2)] = 2;
    expect(sim.planRoadLine(2, 2, 2, 2).error).toBe('occupied');
    expect(sim.planRoadLine(30, 30, 30, 30).error).toBe('occupied');
    expect(sim.state.level[idx(2, 2)]).toBe(2);
  });

  it('charges the whole footprint when a bulldoze rectangle clips a building', () => {
    const sim = founded();
    sim.placeBuilding('school', 10, 10);
    const money = sim.state.money;
    expect(sim.bulldozeRect(11, 11, 11, 11)).toEqual({ ok: true, cost: 8 });
    expect(sim.state.buildings.size).toBe(1);
    expect(sim.state.money).toBe(money - 8);
  });
});
