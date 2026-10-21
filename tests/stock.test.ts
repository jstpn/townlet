import { describe, expect, it } from 'vitest';
import { Sim, type SimOptions } from '../src/sim/sim';
import { Terrain } from '../src/sim/types';
import { flatTerrain } from './helpers';

const camp = (options: Partial<SimOptions> = {}): Sim =>
  new Sim({
    seed: 'test',
    difficulty: 'normal',
    terrain: flatTerrain(Terrain.Grass),
    age: 'forager',
    ...options,
  });

describe('stock', () => {
  it('starts a forager town with a quarter of its caps on normal', () => {
    const sim = camp();
    expect(sim.state.stock).toEqual({ food: 15, wood: 10, stone: 10 });
  });

  it('keeps the motor city on its v1 treasury with no stock', () => {
    const sim = new Sim({
      seed: 'test',
      difficulty: 'normal',
      terrain: flatTerrain(Terrain.Grass),
    });
    expect(sim.state.age).toBe('motor');
    expect(sim.state.money).toBe(10000);
    expect(sim.state.stock).toEqual({});
  });

  it('caps the stock at the age base plus storage', () => {
    const sim = camp({ difficulty: 'easy' });
    sim.placeBuilding('camp', 30, 30);
    expect(sim.caps()).toEqual({ food: 60, wood: 40, stone: 40 });
    expect(sim.placeBuilding('dryingRack', 33, 30).ok).toBe(true);
    expect(sim.caps()).toEqual({ food: 120, wood: 40, stone: 40 });
  });

  it('founds a forager town with the camp and nothing else', () => {
    const sim = camp();
    expect(sim.placeBuilding('tent', 20, 20)).toEqual({ ok: false, reason: 'needs-town-hall' });
    expect(sim.placeBuilding('camp', 30, 30).ok).toBe(true);
    expect(sim.state.founded).toBe(true);
    expect(sim.placeBuilding('camp', 20, 20)).toEqual({ ok: false, reason: 'already-built' });
    expect(sim.planBulldozeRect(30, 30, 30, 30).error).toBe('protected');
  });

  it("offers only the age's own buildings and zones", () => {
    const forager = camp();
    forager.placeBuilding('camp', 30, 30);
    expect(forager.placeBuilding('townHall', 20, 20)).toEqual({ ok: false, reason: 'wrong-age' });
    expect(forager.zoneRect(1, 20, 20, 21, 21)).toEqual({ ok: false, reason: 'wrong-age' });
    const motor = new Sim({
      seed: 'test',
      difficulty: 'normal',
      terrain: flatTerrain(Terrain.Grass),
    });
    motor.placeBuilding('townHall', 30, 30);
    expect(motor.placeBuilding('tent', 20, 20)).toEqual({ ok: false, reason: 'wrong-age' });
  });

  it('prices buildings in materials scaled by difficulty, paid from the stock', () => {
    const normal = camp();
    normal.placeBuilding('camp', 30, 30);
    expect(normal.planBuilding('tent', 20, 20)).toMatchObject({ cost: 0, materials: { wood: 4 } });
    expect(normal.placeBuilding('tent', 20, 20).ok).toBe(true);
    expect(normal.state.stock).toEqual({ food: 15, wood: 6, stone: 10 });
    const hard = camp({ difficulty: 'hard' });
    hard.placeBuilding('camp', 30, 30);
    expect(hard.planBuilding('tent', 20, 20).materials).toEqual({ wood: 5 });
  });

  it('refuses a building the stock cannot pay for and takes nothing', () => {
    const sim = camp();
    sim.placeBuilding('camp', 30, 30);
    sim.state.stock.wood = 3;
    expect(sim.placeBuilding('tent', 20, 20)).toEqual({ ok: false, reason: 'short' });
    expect(sim.state.stock.wood).toBe(3);
    expect(sim.state.buildings.size).toBe(1);
  });

  it('lays forager paths and clears forest for nothing', () => {
    const sim = camp();
    sim.placeBuilding('camp', 30, 30);
    sim.state.terrain[20 * 64 + 22] = Terrain.Forest;
    const plan = sim.planRoadLine(20, 20, 26, 20);
    expect(plan.error).toBeUndefined();
    expect(plan.cost).toBe(0);
    expect(sim.placeRoadLine(20, 20, 26, 20).ok).toBe(true);
    expect(sim.state.stock).toEqual({ food: 15, wood: 10, stone: 10 });
  });
});
