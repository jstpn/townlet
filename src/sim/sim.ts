import { BULLDOZE_COST, ROAD_COST } from './catalogue';
import { DIFFICULTY, type Difficulty } from './difficulty';
import { TILE_COUNT, idx, inBounds, lineTiles, rectTiles, snapToAxis, xOf, yOf } from './grid';
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
  'out-of-bounds' | 'water' | 'occupied' | 'insufficient-funds' | 'nothing-to-build';

export type CommandResult = { ok: true; cost: number } | { ok: false; reason: CommandError };

export type PlanStatus = 'change' | 'keep' | 'blocked';

/** One tile of a planned command: `change` tiles will be altered, `keep` stays as is, `blocked` cannot. */
export type PlanTile = { x: number; y: number; status: PlanStatus };

/** What a command would do, priced, so the UI can preview it before committing. */
export type Plan = { tiles: PlanTile[]; cost: number; error?: CommandError };

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

  /**
   * Road along a straight line from the first point toward the second, snapped to the axis that
   * moved most. Existing road is free, water is skipped, forest is cleared for the bulldoze fee.
   */
  planRoadLine(x0: number, y0: number, x1: number, y1: number): Plan {
    const end = snapToAxis({ x: x0, y: y0 }, { x: x1, y: y1 });
    const tiles = lineTiles(x0, y0, end.x, end.y);
    let cost = 0;
    const planned = tiles.map((tile): PlanTile => {
      const status: PlanStatus =
        this.state.terrain[tile] === Terrain.Water
          ? 'blocked'
          : this.state.road[tile] === 1
            ? 'keep'
            : 'change';
      if (status === 'change') cost += this.price(ROAD_COST) + this.clearingFee(tile);
      return { x: xOf(tile), y: yOf(tile), status };
    });
    if (tiles.length === 0) return { tiles: planned, cost, error: 'out-of-bounds' };
    if (planned.every((t) => t.status === 'blocked'))
      return { tiles: planned, cost, error: 'water' };
    if (!planned.some((t) => t.status === 'change')) {
      return { tiles: planned, cost, error: 'nothing-to-build' };
    }
    return this.priced(planned, cost);
  }

  placeRoadLine(x0: number, y0: number, x1: number, y1: number): CommandResult {
    return this.execute(this.planRoadLine(x0, y0, x1, y1), (tile) => {
      this.clearForest(tile);
      this.state.road[tile] = 1;
      this.state.rev.roads++;
    });
  }

  /** Clears road and forest from every tile in a rectangle, for a flat fee per cleared tile. */
  planBulldozeRect(x0: number, y0: number, x1: number, y1: number): Plan {
    const planned = rectTiles(x0, y0, x1, y1).map((tile): PlanTile => ({
      x: xOf(tile),
      y: yOf(tile),
      status:
        this.state.road[tile] === 1 || this.state.terrain[tile] === Terrain.Forest
          ? 'change'
          : 'keep',
    }));
    const count = planned.filter((t) => t.status === 'change').length;
    if (planned.length === 0) return { tiles: planned, cost: 0, error: 'out-of-bounds' };
    if (count === 0) return { tiles: planned, cost: 0, error: 'nothing-to-build' };
    return this.priced(planned, count * this.price(BULLDOZE_COST));
  }

  bulldozeRect(x0: number, y0: number, x1: number, y1: number): CommandResult {
    return this.execute(this.planBulldozeRect(x0, y0, x1, y1), (tile) => {
      if (this.state.road[tile] === 1) {
        this.state.road[tile] = 0;
        this.state.rev.roads++;
      }
      this.clearForest(tile);
    });
  }

  private price(base: number): number {
    return Math.round(base * DIFFICULTY[this.state.difficulty].costMultiplier);
  }

  private clearingFee(tile: number): number {
    return this.state.terrain[tile] === Terrain.Forest ? this.price(BULLDOZE_COST) : 0;
  }

  private priced(tiles: PlanTile[], cost: number): Plan {
    return cost > this.state.money ? { tiles, cost, error: 'insufficient-funds' } : { tiles, cost };
  }

  /** Charges for a plan and applies it to every changing tile. Plans with an error change nothing. */
  private execute(plan: Plan, apply: (tile: number) => void): CommandResult {
    if (plan.error) return { ok: false, reason: plan.error };
    this.state.money -= plan.cost;
    for (const t of plan.tiles) {
      if (t.status === 'change' && inBounds(t.x, t.y)) apply(idx(t.x, t.y));
    }
    return { ok: true, cost: plan.cost };
  }

  private clearForest(tile: number): void {
    if (this.state.terrain[tile] !== Terrain.Forest) return;
    this.state.terrain[tile] = Terrain.Grass;
    this.state.rev.terrain++;
  }
}
