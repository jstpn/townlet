import { describe, expect, it } from 'vitest';
import { idx } from '../src/sim/grid';
import type { Sim } from '../src/sim/sim';
import { Zone } from '../src/sim/types';
import { days, foundedSim, fullLot } from './helpers';

/** A block of full homes, placed directly. */
const block = (sim: Sim, x0: number, y0: number, x1: number, y1: number): void => {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) fullLot(sim, x, y, Zone.Residential, 2);
  }
};

describe('fire', () => {
  it('burns a covered lot for three days, then drops it to an empty lot of the same zone', () => {
    const sim = foundedSim();
    sim.placeRoadLine(26, 33, 35, 33);
    block(sim, 28, 34, 28, 34);
    const lot = idx(28, 34);
    expect(sim.ignite(28, 34)).toBe(true);
    expect(sim.state.fire[lot]).toBe(3);
    days(sim, 2);
    expect(sim.state.fire[lot]).toBe(1);
    expect(sim.state.level[lot]).toBe(2);
    days(sim, 1);
    expect(sim.state.fire[lot]).toBe(0);
    expect(sim.state.level[lot]).toBe(0);
    expect(sim.state.occupancy[lot]).toBe(0);
    expect(sim.state.zone[lot]).toBe(Zone.Residential);
  });

  it('burns ten days without fire cover and destroys a burnt service', () => {
    const sim = foundedSim();
    sim.placeRoadLine(8, 12, 12, 12);
    sim.placeBuilding('windTurbine', 8, 8);
    sim.placeBuilding('waterTower', 12, 8);
    sim.placeBuilding('park', 10, 10);
    expect(sim.ignite(10, 10)).toBe(true);
    expect(sim.state.fire[idx(10, 10)]).toBe(10);
    days(sim, 10);
    expect(sim.state.buildings.size).toBe(3);
    expect(sim.state.buildingId[idx(10, 10)]).toBe(-1);
  });

  it('spreads to developed orthogonal neighbours and never to the town hall or empty land', () => {
    const sim = foundedSim();
    sim.placeRoadLine(6, 9, 14, 9);
    block(sim, 8, 10, 12, 12);
    expect(sim.ignite(30, 30)).toBe(false);
    expect(sim.ignite(10, 11)).toBe(true);
    days(sim, 6);
    expect(sim.state.fire.filter((days) => days > 0).length).toBeGreaterThan(1);
    expect(sim.state.fire[idx(7, 11)]).toBe(0);
    expect(sim.state.fire[idx(10, 9)]).toBe(0);
    expect(sim.takeEvents()).toContainEqual({ kind: 'fire', x: 10, y: 11 });
  });

  it('never starts on easy and does start on hard within a year', () => {
    const easy = foundedSim({ difficulty: 'easy' });
    easy.placeRoadLine(26, 33, 35, 33);
    block(easy, 27, 34, 31, 35);
    days(easy, 360);
    expect(easy.takeEvents().some((e) => e.kind === 'fire')).toBe(false);

    const hard = foundedSim({ difficulty: 'hard' });
    hard.placeRoadLine(26, 33, 35, 33);
    block(hard, 27, 34, 31, 35);
    days(hard, 360);
    expect(hard.takeEvents().some((e) => e.kind === 'fire')).toBe(true);
  });
});
