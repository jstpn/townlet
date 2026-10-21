import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../src/sim/difficulty';
import { Sim } from '../src/sim/sim';
import { Terrain } from '../src/sim/types';
import { days, flatTerrain } from './helpers';

/** A founded forager camp (6 beds) at (30, 30) on flat grass, with the food stock given. */
function camp(food: number, difficulty: Difficulty = 'normal'): Sim {
  const sim = new Sim({
    seed: 'test',
    difficulty,
    terrain: flatTerrain(Terrain.Grass),
    age: 'forager',
  });
  sim.placeBuilding('camp', 30, 30);
  sim.state.stock.food = food;
  return sim;
}

describe('arrivals', () => {
  it('brings one resident to the camp every three days on normal', () => {
    const sim = camp(500);
    days(sim, 2);
    expect(sim.state.population).toBe(0);
    days(sim, 1);
    expect(sim.state.population).toBe(1);
    days(sim, 3);
    expect(sim.state.population).toBe(2);
  });

  it('stops when the beds are full and resumes when a tent by a path goes up', () => {
    const sim = camp(1000);
    days(sim, 60);
    expect(sim.state.population).toBe(6);
    sim.placeBuilding('tent', 20, 20);
    days(sim, 30);
    expect(sim.state.population).toBe(6);
    sim.placeRoadLine(18, 22, 24, 22);
    days(sim, 30);
    expect(sim.state.population).toBe(9);
  });

  it('waits until the stock feeds the town and the newcomer for ten days', () => {
    const sim = camp(19);
    sim.state.population = 1;
    days(sim, 10);
    expect(sim.state.population).toBe(1);
  });
});

describe('eating', () => {
  it('takes one food per resident a day', () => {
    const sim = camp(100);
    sim.state.population = 3;
    sim.step();
    expect(sim.state.stock.food).toBe(97);
  });

  it('sends one away every four days on normal while the food is out, and none arrive', () => {
    const sim = camp(0);
    sim.state.population = 3;
    days(sim, 3);
    expect(sim.state.population).toBe(3);
    expect(sim.state.happiness).toBe(70);
    days(sim, 1);
    expect(sim.state.population).toBe(2);
    days(sim, 4);
    expect(sim.state.population).toBe(1);
    expect(sim.state.happiness).toBe(20);
    expect(sim.state.stock.food).toBe(0);
  });

  it('loses the town when the last resident leaves on normal', () => {
    const sim = camp(0);
    sim.state.population = 1;
    days(sim, 4);
    expect(sim.state.population).toBe(0);
    expect(sim.state.status).toBe('lost');
    expect(sim.takeEvents()).toContainEqual({ kind: 'lost' });
  });

  it('never loses on easy, where they leave every six days', () => {
    const sim = camp(0, 'easy');
    sim.state.population = 1;
    days(sim, 5);
    expect(sim.state.population).toBe(1);
    days(sim, 1);
    expect(sim.state.population).toBe(0);
    days(sim, 30);
    expect(sim.state.status).toBe('playing');
  });

  it('keeps residents fed from a partial stock and no longer hungry once food returns', () => {
    const sim = camp(2);
    sim.state.population = 3;
    sim.step();
    expect(sim.state.stock.food).toBe(0);
    expect(sim.state.happiness).toBe(90);
    sim.state.stock.food = 50;
    sim.step();
    expect(sim.state.happiness).toBe(100);
    expect(sim.state.population).toBe(3);
  });
});
