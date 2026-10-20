import { BULLDOZE_COST, ROAD_COST } from './catalogue';
import { DIFFICULTY, type Difficulty } from './difficulty';
import { TILE_COUNT, idx, inBounds } from './grid';
import { generateMap } from './mapgen';
import { Terrain } from './types';

export type SimOptions = {
  seed: string;
  difficulty: Difficulty;
  /** Override the generated map, for tests. */
  terrain?: Uint8Array;
  /** Override the starting money, for tests. */
  money?: number;
};

export type CommandError =
  'out-of-bounds' | 'water' | 'occupied' | 'insufficient-funds' | 'not-a-line' | 'nothing-to-build';

export type CommandResult = { ok: true; cost: number } | { ok: false; reason: CommandError };

export type SimState = {
  seed: string;
  difficulty: Difficulty;
  day: number;
  money: number;
  terrain: Uint8Array;
  road: Uint8Array;
  /** Bumped whenever the matching layer changes, so renderers know what to rebuild. */
  rev: { terrain: number; roads: number };
};

/** The whole town simulation: state plus the commands that change it. Deterministic, no DOM. */
export class Sim {
  readonly state: SimState;

  constructor(options: SimOptions) {
    const settings = DIFFICULTY[options.difficulty];
    this.state = {
      seed: options.seed,
      difficulty: options.difficulty,
      day: 0,
      money: options.money ?? settings.startingMoney,
      terrain: options.terrain ?? generateMap(options.seed).terrain,
      road: new Uint8Array(TILE_COUNT),
      rev: { terrain: 0, roads: 0 },
    };
  }

  placeRoad(x: number, y: number): CommandResult {
    return this.placeRoadLine(x, y, x, y);
  }

  /**
   * Lays road along a horizontal or vertical line. Tiles that already hold road are free,
   * water tiles are skipped, and the whole line is refused only when nothing could be built.
   */
  placeRoadLine(x0: number, y0: number, x1: number, y1: number): CommandResult {
    if (x0 !== x1 && y0 !== y1) return { ok: false, reason: 'not-a-line' };
    const tiles = this.lineTiles(x0, y0, x1, y1).filter((tile) => this.state.road[tile] === 0);
    if (tiles.length === 0 && !inBounds(x0, y0)) return { ok: false, reason: 'out-of-bounds' };
    const buildable = tiles.filter((tile) => this.state.terrain[tile] !== Terrain.Water);
    if (buildable.length === 0) {
      return { ok: false, reason: tiles.length > 0 ? 'water' : 'nothing-to-build' };
    }
    const forest = buildable.filter((tile) => this.state.terrain[tile] === Terrain.Forest).length;
    const cost = this.price(ROAD_COST) * buildable.length + this.price(BULLDOZE_COST) * forest;
    if (this.state.money < cost) return { ok: false, reason: 'insufficient-funds' };
    this.state.money -= cost;
    for (const tile of buildable) {
      this.clearForest(tile);
      this.state.road[tile] = 1;
    }
    this.state.rev.roads++;
    return { ok: true, cost };
  }

  /** Removes whatever is on the tile: road or forest. Costs the same either way. */
  bulldoze(x: number, y: number): CommandResult {
    if (!inBounds(x, y)) return { ok: false, reason: 'out-of-bounds' };
    const tile = idx(x, y);
    const hasRoad = this.state.road[tile] === 1;
    const hasForest = this.state.terrain[tile] === Terrain.Forest;
    if (!hasRoad && !hasForest) return { ok: false, reason: 'nothing-to-build' };
    const cost = this.price(BULLDOZE_COST);
    if (this.state.money < cost) return { ok: false, reason: 'insufficient-funds' };
    this.state.money -= cost;
    if (hasRoad) {
      this.state.road[tile] = 0;
      this.state.rev.roads++;
    } else {
      this.clearForest(tile);
    }
    return { ok: true, cost };
  }

  private clearForest(tile: number): void {
    if (this.state.terrain[tile] !== Terrain.Forest) return;
    this.state.terrain[tile] = Terrain.Grass;
    this.state.rev.terrain++;
  }

  private lineTiles(x0: number, y0: number, x1: number, y1: number): number[] {
    const tiles: number[] = [];
    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const x = x0 + dx * i;
      const y = y0 + dy * i;
      if (inBounds(x, y)) tiles.push(idx(x, y));
    }
    return tiles;
  }

  private price(base: number): number {
    return Math.round(base * DIFFICULTY[this.state.difficulty].costMultiplier);
  }
}
