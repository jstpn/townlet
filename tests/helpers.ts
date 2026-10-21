import { TILE_COUNT, idx } from '../src/sim/grid';
import { Sim, type SimOptions } from '../src/sim/sim';
import { Terrain, type Zone } from '../src/sim/types';

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

/** A full lot of the given zone and level, placed directly. */
export function fullLot(sim: Sim, x: number, y: number, zone: Zone, level: number): void {
  sim.state.zone[idx(x, y)] = zone;
  sim.state.level[idx(x, y)] = level;
  sim.state.occupancy[idx(x, y)] = 1;
  sim.state.rev.zones++;
}

export function days(sim: Sim, n: number): void {
  for (let i = 0; i < n; i++) sim.step();
}
