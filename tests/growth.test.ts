import { describe, expect, it } from 'vitest';
import { idx } from '../src/sim/grid';
import type { Sim } from '../src/sim/sim';
import { Zone } from '../src/sim/types';
import { days, foundedSim } from './helpers';

/** A town hall at (30, 30) and a road along y = 33, so lots beside it are served and reachable. */
const town = (): Sim => {
  const sim = foundedSim();
  sim.placeRoadLine(26, 33, 35, 33);
  return sim;
};

describe('demand', () => {
  it('starts wanting residents to fill the town hall jobs', () => {
    const sim = town();
    sim.step();
    expect(sim.state.day).toBe(1);
    expect(sim.state.demand[Zone.Residential]).toBe(1);
    expect(sim.state.demand[Zone.Commercial]).toBe(0);
    expect(sim.state.demand[Zone.Industrial]).toBeCloseTo(0.15);
    expect(sim.state.population).toBe(0);
    expect(sim.state.jobs).toBe(20);
  });
});

describe('growth', () => {
  it('develops served residential lots beside a road and fills them', () => {
    const sim = town();
    sim.zoneRect(Zone.Residential, 28, 34, 33, 35);
    days(sim, 200);
    const lot = idx(30, 34);
    expect(sim.state.level[lot]).toBeGreaterThanOrEqual(1);
    expect(sim.state.occupancy[lot]).toBeGreaterThan(0.5);
    expect(sim.state.population).toBeGreaterThan(0);
  });

  it('never develops lots without road access or without power and water', () => {
    const sim = town();
    sim.zoneRect(Zone.Residential, 30, 36, 30, 36);
    sim.placeRoadLine(10, 10, 14, 10);
    sim.zoneRect(Zone.Residential, 12, 11, 12, 11);
    days(sim, 300);
    expect(sim.state.level[idx(30, 36)]).toBe(0);
    expect(sim.state.level[idx(12, 11)]).toBe(0);
  });

  it('is deterministic for a seed', () => {
    const a = town();
    const b = town();
    for (const sim of [a, b]) sim.zoneRect(Zone.Residential, 28, 34, 33, 35);
    days(a, 120);
    days(b, 120);
    expect(Array.from(a.state.level)).toEqual(Array.from(b.state.level));
    expect(Array.from(a.state.occupancy)).toEqual(Array.from(b.state.occupancy));
  });

  it('empties lots when the town is unhappy', () => {
    const sim = town();
    sim.placeRoadLine(8, 12, 12, 12);
    sim.placeBuilding('windTurbine', 8, 8);
    sim.placeBuilding('waterTower', 12, 8);
    sim.zoneRect(Zone.Residential, 10, 10, 10, 10);
    sim.zoneRect(Zone.Industrial, 10, 11, 10, 11);
    const home = idx(10, 10);
    sim.state.level[home] = 2;
    sim.state.occupancy[home] = 0.5;
    sim.state.level[idx(10, 11)] = 3;
    sim.state.occupancy[idx(10, 11)] = 1;
    sim.state.rev.zones++;
    sim.setTaxRate(20);
    days(sim, 20);
    expect(sim.state.happiness).toBeLessThan(40);
    expect(sim.state.occupancy[home]).toBe(0);
    expect(sim.state.level[home]).toBe(2);
  });

  it('demotes blighted lots after sixty days', () => {
    const sim = town();
    sim.placeRoadLine(8, 12, 12, 12);
    sim.zoneRect(Zone.Residential, 10, 10, 10, 10);
    sim.zoneRect(Zone.Industrial, 10, 11, 10, 11);
    const home = idx(10, 10);
    const works = idx(10, 11);
    sim.state.level[home] = 1;
    sim.state.level[works] = 3;
    sim.state.occupancy[works] = 1;
    sim.state.rev.zones++;
    days(sim, 59);
    expect(sim.state.level[home]).toBe(1);
    days(sim, 2);
    expect(sim.state.level[home]).toBe(0);
    expect(sim.state.zone[home]).toBe(Zone.Residential);
  });
});

describe('losing services', () => {
  it('empties lots that lose power or road access', () => {
    const sim = town();
    sim.zoneRect(Zone.Residential, 30, 34, 30, 34);
    const lot = idx(30, 34);
    sim.state.level[lot] = 1;
    sim.state.occupancy[lot] = 1;
    sim.state.rev.zones++;
    sim.bulldozeRect(26, 33, 35, 33);
    days(sim, 40);
    expect(sim.state.occupancy[lot]).toBe(0);
  });
});
