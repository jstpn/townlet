import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../src/sim/difficulty';
import { Sim } from '../src/sim/sim';
import { Terrain } from '../src/sim/types';
import { days, flatTerrain } from './helpers';

function camp(difficulty: Difficulty = 'normal', found = true): Sim {
  const sim = new Sim({
    seed: 'test',
    difficulty,
    terrain: flatTerrain(Terrain.Grass),
    age: 'forager',
  });
  if (found) sim.placeBuilding('camp', 30, 30);
  sim.state.stock = { food: 60, wood: 40, stone: 40 };
  return sim;
}

describe('advancements', () => {
  it('offers Fire once the camp stands', () => {
    const unfounded = camp('normal', false);
    expect(unfounded.startResearch('fire')).toEqual({ ok: false, reason: 'locked' });
    const sim = camp();
    expect(sim.startResearch('fire')).toEqual({ ok: true, cost: 0 });
    expect(sim.state.research).toEqual({ id: 'fire', daysLeft: 30 });
  });

  it('locks Grinding stones until Fire is held and a gathering hut stands', () => {
    const sim = camp();
    sim.placeBuilding('gatheringHut', 20, 20);
    expect(sim.startResearch('grindingStones')).toEqual({ ok: false, reason: 'locked' });
    sim.state.held.add('fire');
    sim.bulldozeRect(20, 20, 20, 20);
    expect(sim.startResearch('grindingStones')).toEqual({ ok: false, reason: 'locked' });
    sim.placeBuilding('gatheringHut', 20, 20);
    expect(sim.startResearch('grindingStones').ok).toBe(true);
  });

  it('pays the whole cost at the start, scaled by difficulty', () => {
    const sim = camp();
    sim.startResearch('fire');
    expect(sim.state.stock.wood).toBe(30);
    const hard = camp('hard');
    hard.startResearch('fire');
    expect(hard.state.stock.wood).toBe(27);
  });

  it('refuses a second research, one already held, or one the stock cannot pay', () => {
    const sim = camp();
    sim.state.stock.wood = 9;
    expect(sim.startResearch('fire')).toEqual({ ok: false, reason: 'short' });
    expect(sim.state.stock.wood).toBe(9);
    expect(sim.state.research).toBeNull();
    sim.state.stock.wood = 40;
    sim.placeBuilding('gatheringHut', 20, 20);
    sim.startResearch('fire');
    sim.state.held.add('fire');
    expect(sim.startResearch('grindingStones')).toEqual({ ok: false, reason: 'busy' });
    sim.state.research = null;
    expect(sim.startResearch('fire')).toEqual({ ok: false, reason: 'held' });
  });

  it('completes after 30 days on normal, 24 on easy and 38 on hard, and says so', () => {
    for (const [difficulty, length] of [
      ['normal', 30],
      ['easy', 24],
      ['hard', 38],
    ] as const) {
      const sim = camp(difficulty);
      sim.state.stock.food = 0;
      sim.startResearch('fire');
      days(sim, length - 1);
      expect(sim.state.held.has('fire')).toBe(false);
      sim.takeEvents();
      sim.step();
      expect(sim.state.held.has('fire')).toBe(true);
      expect(sim.state.research).toBeNull();
      expect(sim.takeEvents()).toContainEqual({ kind: 'advanced', id: 'fire' });
    }
  });

  it("keeps another age's advancements out of reach", () => {
    const motor = new Sim({
      seed: 'test',
      difficulty: 'normal',
      terrain: flatTerrain(Terrain.Grass),
    });
    motor.placeBuilding('townHall', 30, 30);
    expect(motor.startResearch('fire')).toEqual({ ok: false, reason: 'locked' });
  });
});
