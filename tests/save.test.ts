import { describe, expect, it } from 'vitest';
import { restoreSim, snapshot } from '../src/sim/save';
import { Sim } from '../src/sim/sim';
import { days, foundedSim } from './helpers';

function builtTown(): Sim {
  const sim = foundedSim({});
  sim.placeRoadLine(20, 33, 44, 33);
  sim.placeBuilding('windTurbine', 25, 28);
  sim.placeBuilding('waterTower', 35, 28);
  sim.zoneRect(1, 22, 34, 30, 34);
  sim.zoneRect(2, 31, 34, 36, 34);
  sim.zoneRect(3, 37, 34, 42, 34);
  days(sim, 95);
  return sim;
}

describe('save', () => {
  it('round-trips through a plain object and keeps simulating identically', () => {
    const original = builtTown();
    const snap = JSON.parse(JSON.stringify(snapshot(original))) as ReturnType<typeof snapshot>;
    const restored = restoreSim(snap);
    expect(restored.state.day).toBe(original.state.day);
    expect(restored.state.population).toBe(original.state.population);
    expect(restored.state.buildings.size).toBe(original.state.buildings.size);
    expect(restored.state.level).toEqual(original.state.level);
    days(original, 70);
    days(restored, 70);
    expect(restored.state.population).toBe(original.state.population);
    expect(restored.state.money).toBe(original.state.money);
    expect(restored.state.level).toEqual(original.state.level);
    expect(restored.state.occupancy).toEqual(original.state.occupancy);
  });

  it('restores an unfounded town with nothing built', () => {
    const sim = new Sim({ seed: 'fresh', difficulty: 'hard' });
    const restored = restoreSim(snapshot(sim));
    expect(restored.state.founded).toBe(false);
    expect(restored.state.difficulty).toBe('hard');
    expect(restored.state.terrain).toEqual(sim.state.terrain);
  });
});
