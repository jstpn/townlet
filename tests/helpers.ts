import { TILE_COUNT } from '../src/sim/grid';
import { Sim, type SimOptions } from '../src/sim/sim';
import { Terrain } from '../src/sim/types';

export function flatTerrain(kind: Terrain): Uint8Array {
  return new Uint8Array(TILE_COUNT).fill(kind);
}

/** A normal-difficulty town on flat grass with its hall already founded at (30, 30). */
export function foundedSim(options: Partial<SimOptions> = {}): Sim {
  const sim = new Sim({
    seed: options.seed ?? 'test',
    difficulty: options.difficulty ?? 'normal',
    terrain: options.terrain ?? flatTerrain(Terrain.Grass),
    money: options.money,
  });
  sim.placeBuilding('townHall', 30, 30);
  return sim;
}

export function days(sim: Sim, n: number): void {
  for (let i = 0; i < n; i++) sim.step();
}
