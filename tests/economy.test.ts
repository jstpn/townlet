import { describe, expect, it } from 'vitest';
import { idx } from '../src/sim/grid';
import { Sim } from '../src/sim/sim';
import { Terrain, Zone } from '../src/sim/types';
import { flatTerrain } from './helpers';

const town = (difficulty: 'easy' | 'normal' | 'hard' = 'normal', money?: number): Sim => {
  const sim = new Sim({ seed: 'test', difficulty, terrain: flatTerrain(Terrain.Grass), money });
  sim.placeBuilding('townHall', 30, 30);
  sim.placeRoadLine(26, 33, 30, 33);
  return sim;
};

const days = (sim: Sim, n: number): void => {
  for (let i = 0; i < n; i++) sim.step();
};

/** A full residential lot at the given level, placed directly. */
const fullLot = (sim: Sim, x: number, y: number, zone: Zone, level: number): void => {
  sim.state.zone[idx(x, y)] = zone;
  sim.state.level[idx(x, y)] = level;
  sim.state.occupancy[idx(x, y)] = 1;
  sim.state.rev.zones++;
};

describe('monthly budget', () => {
  it('settles upkeep and tax on the first day of each month', () => {
    const sim = town();
    sim.placeBuilding('park', 10, 10);
    const money = sim.state.money;
    days(sim, 29);
    expect(sim.state.money).toBe(money);
    sim.step();
    expect(sim.state.day).toBe(30);
    expect(sim.state.money).toBe(money - 10);
    expect(sim.state.budget).toEqual({
      income: 0,
      expenses: 10,
      taxes: { 1: 0, 2: 0, 3: 0 },
      upkeep: { park: 5, road: 5 },
    });
  });

  it('taxes developed lots by level, occupancy and rate', () => {
    const sim = town();
    fullLot(sim, 28, 34, Zone.Residential, 3);
    fullLot(sim, 29, 34, Zone.Commercial, 1);
    sim.setTaxRate(20);
    days(sim, 30);
    expect(sim.state.budget.income).toBeCloseTo((15 + 3) * 2);
    expect(sim.state.budget.taxes).toEqual({ 1: 30, 2: 6, 3: 0 });
  });

  it('scales upkeep by difficulty', () => {
    const sim = town('hard');
    days(sim, 30);
    expect(sim.state.budget.expenses).toBeCloseTo(5 * 1.3);
  });
});

describe('happiness', () => {
  it('is high for a fresh town and falls with the tax rate', () => {
    const sim = town();
    sim.step();
    expect(sim.state.happiness).toBeCloseTo(820 / 9, 1);
    sim.setTaxRate(0);
    sim.step();
    expect(sim.state.happiness).toBe(100);
    sim.setTaxRate(20);
    sim.step();
    expect(sim.state.happiness).toBeCloseTo(700 / 9, 1);
  });

  it('punishes smoke over homes and missing services', () => {
    const sim = town();
    sim.placeRoadLine(8, 12, 12, 12);
    fullLot(sim, 10, 10, Zone.Residential, 1);
    fullLot(sim, 10, 11, Zone.Industrial, 2);
    sim.step();
    // Tax 60, coverage 0, parks 0, pollution 0, employment 100.
    expect(sim.state.happiness).toBeCloseTo((120 + 0 + 0 + 0 + 200) / 9, 1);
  });
});

describe('ending the game', () => {
  it('loses below the debt limit on normal and stops stepping', () => {
    const sim = town();
    sim.state.money = -4999;
    days(sim, 30);
    expect(sim.state.status).toBe('lost');
    expect(sim.takeEvents()).toContainEqual({ kind: 'lost' });
    const day = sim.state.day;
    sim.step();
    expect(sim.state.day).toBe(day);
  });

  it('never loses on easy', () => {
    const sim = town('easy');
    sim.state.money = -20000;
    days(sim, 60);
    expect(sim.state.status).toBe('playing');
  });

  it('wins at the resident target and keeps going', () => {
    const sim = town('easy');
    for (let i = 0; i < 70; i++) fullLot(sim, 2 + (i % 20), 40 + Math.floor(i / 20), Zone.Residential, 3);
    sim.step();
    expect(sim.state.status).toBe('won');
    expect(sim.takeEvents()).toContainEqual({ kind: 'won' });
    sim.step();
    expect(sim.state.day).toBe(2);
    expect(sim.takeEvents()).not.toContainEqual({ kind: 'won' });
  });
});

describe('before founding', () => {
  it('does not advance the calendar', () => {
    const sim = new Sim({ seed: 'test', difficulty: 'normal', terrain: flatTerrain(Terrain.Grass) });
    sim.step();
    expect(sim.state.day).toBe(0);
  });
});

describe('milestones', () => {
  it('announces founding, the first of each service and population marks', () => {
    const sim = new Sim({ seed: 'test', difficulty: 'normal', terrain: flatTerrain(Terrain.Grass) });
    sim.placeBuilding('townHall', 30, 30);
    expect(sim.takeEvents()).toEqual([{ kind: 'founded' }]);
    sim.placeBuilding('park', 10, 10);
    sim.placeBuilding('park', 12, 12);
    expect(sim.takeEvents()).toEqual([{ kind: 'service', building: 'park' }]);
    for (let i = 0; i < 4; i++) fullLot(sim, 2 + i, 40, Zone.Residential, 3);
    sim.step();
    expect(sim.takeEvents()).toEqual([{ kind: 'population', count: 100 }]);
    sim.step();
    expect(sim.takeEvents()).toEqual([]);
  });
});
