import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../src/sim/difficulty';
import { idx } from '../src/sim/grid';
import type { Building, Sim } from '../src/sim/sim';
import { Terrain } from '../src/sim/types';
import { days, foundedSim } from './helpers';

/** A founded forager camp (6 beds) at (30, 30) on flat grass, with the food stock given. */
function camp(food: number, difficulty: Difficulty = 'normal'): Sim {
  const sim = foundedSim({ age: 'forager', difficulty });
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

describe('work', () => {
  /** A camp at (30, 30) with a path along y = 33 from x 20 to 44 and forest at the tiles given. */
  function village(population: number, forest: [number, number][]): Sim {
    const sim = camp(100);
    sim.placeRoadLine(20, 33, 44, 33);
    for (const [x, y] of forest) sim.state.terrain[idx(x, y)] = Terrain.Forest;
    sim.state.stock = { food: 50, wood: 40, stone: 40 };
    sim.state.population = population;
    return sim;
  }
  const at = (sim: Sim, x: number, y: number): Building | undefined =>
    [...sim.state.buildings.values()].find((b) => b.x === x && b.y === y);

  it('staffs the camp first, then makes two food a worker at a gathering hut by forest', () => {
    const sim = village(4, [[37, 34]]);
    sim.placeBuilding('gatheringHut', 34, 34);
    sim.step();
    expect(at(sim, 30, 30)?.workers).toBe(2);
    expect(at(sim, 34, 34)?.workers).toBe(2);
    expect(sim.state.stock.food).toBe(50);
  });

  it('gives no workers to a hut without a path or without forest within three', () => {
    const sim = village(6, [[10, 13]]);
    sim.placeBuilding('gatheringHut', 34, 35);
    sim.placeBuilding('gatheringHut', 10, 10);
    sim.step();
    expect(at(sim, 34, 35)?.workers).toBe(0);
    expect(at(sim, 10, 10)?.workers).toBe(0);
    expect(sim.state.stock.food).toBe(44);
  });

  it('fills the hut nearer a dwelling first and never more slots than residents', () => {
    const sim = village(3, [
      [41, 31],
      [26, 35],
    ]);
    sim.placeBuilding('gatheringHut', 40, 34);
    sim.placeBuilding('gatheringHut', 27, 34);
    sim.step();
    expect(at(sim, 27, 34)?.workers).toBe(1);
    expect(at(sim, 40, 34)?.workers).toBe(0);
    const lone = village(1, []);
    lone.step();
    expect(at(lone, 30, 30)?.workers).toBe(1);
  });

  it('stops the stock at its cap and records what was wasted', () => {
    const sim = village(4, [[37, 34]]);
    sim.placeBuilding('woodcutter', 34, 34);
    sim.state.stock.wood = 38;
    sim.step();
    expect(sim.state.stock.wood).toBe(40);
    expect(at(sim, 34, 34)?.wasted).toBe(2);
    sim.state.stock.wood = 0;
    sim.step();
    expect(at(sim, 34, 34)?.wasted).toBe(0);
  });
});
