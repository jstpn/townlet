import {
  BUILDINGS,
  BULLDOZE_COST,
  ROAD_COST,
  ZONE_COST,
  type BuildingKind,
} from './catalogue';
import { DIFFICULTY, type Difficulty } from './difficulty';
import { type Coverage, computeCoverage, computePollution, computeRoadAccess } from './fields';
import { TILE_COUNT, idx, inBounds, lineTiles, rectTiles, snapToAxis, xOf, yOf } from './grid';
import { type Demand, computeDemand, stepGrowth } from './growth';
import { generateMap } from './mapgen';
import { type Rng, createRng } from './rng';
import { Terrain, Zone, type ZoneKind } from './types';

export type SimOptions = {
  seed: string;
  difficulty: Difficulty;
  /** Override the generated map, for tests. */
  terrain?: Uint8Array;
  /** Override the starting money, for tests. */
  money?: number;
};

export type CommandError =
  | 'out-of-bounds'
  | 'water'
  | 'occupied'
  | 'insufficient-funds'
  | 'nothing-to-build'
  | 'needs-town-hall'
  | 'already-built'
  | 'protected';

export type CommandResult = { ok: true; cost: number } | { ok: false; reason: CommandError };

export type PlanStatus = 'change' | 'keep' | 'blocked';

/** One tile of a planned command: `change` tiles will be altered, `keep` stays as is, `blocked` cannot. */
export type PlanTile = { x: number; y: number; status: PlanStatus };

/** What a command would do, priced, so the UI can preview it before committing. */
export type Plan = { tiles: PlanTile[]; cost: number; error?: CommandError };

export type Building = { id: number; kind: BuildingKind; x: number; y: number };

export type SimState = {
  seed: string;
  difficulty: Difficulty;
  day: number;
  money: number;
  terrain: Uint8Array;
  road: Uint8Array;
  zone: Uint8Array;
  /** Development level of a zoned tile, 0 (empty lot) to 3. */
  level: Uint8Array;
  /** How full a developed tile is, 0 to 1. */
  occupancy: Float32Array;
  /** Building id on each tile, or -1. */
  buildingId: Int32Array;
  buildings: Map<number, Building>;
  nextBuildingId: number;
  townHallId: number | undefined;
  /** Days a developed lot has sat near-empty with negative demand, and days it has been undesirable. */
  starveDays: Uint8Array;
  blightDays: Uint8Array;
  population: number;
  jobs: number;
  demand: Demand;
  /** 0 to 100. Computed by the economy; lots empty out below the difficulty's leave threshold. */
  happiness: number;
  /** Bumped whenever the matching layer changes, so renderers know what to rebuild. */
  rev: { terrain: number; roads: number; zones: number; buildings: number };
};

/** The whole town simulation: state plus the commands that change it. Deterministic, no DOM. */
export class Sim {
  readonly state: SimState;
  private readonly rng: Rng;
  private readonly cache = {
    coverage: { rev: -1, value: undefined as Coverage | undefined },
    roadAccess: { rev: -1, value: undefined as Uint8Array | undefined },
    pollution: { rev: -1, value: undefined as Float32Array | undefined },
  };

  constructor(options: SimOptions) {
    const settings = DIFFICULTY[options.difficulty];
    this.rng = createRng(options.seed + ':sim');
    this.state = {
      seed: options.seed,
      difficulty: options.difficulty,
      day: 0,
      money: options.money ?? settings.startingMoney,
      terrain: options.terrain ?? generateMap(options.seed).terrain,
      road: new Uint8Array(TILE_COUNT),
      zone: new Uint8Array(TILE_COUNT),
      level: new Uint8Array(TILE_COUNT),
      occupancy: new Float32Array(TILE_COUNT),
      buildingId: new Int32Array(TILE_COUNT).fill(-1),
      buildings: new Map(),
      nextBuildingId: 1,
      townHallId: undefined,
      starveDays: new Uint8Array(TILE_COUNT),
      blightDays: new Uint8Array(TILE_COUNT),
      population: 0,
      jobs: 0,
      demand: { residential: 0, commercial: 0, industrial: 0 },
      happiness: 100,
      rev: { terrain: 0, roads: 0, zones: 0, buildings: 0 },
    };
  }

  /** Advances one game day: demand, then growth on every lot. */
  step(): void {
    const s = this.state;
    s.day++;
    Object.assign(s, computeDemand(s));
    const fields = {
      coverage: this.coverage(),
      roadAccess: this.roadAccess(),
      pollution: this.pollution(),
    };
    if (stepGrowth(s, fields, this.rng, DIFFICULTY[s.difficulty])) s.rev.zones++;
  }

  coverage(): Coverage {
    return this.cached(this.cache.coverage, this.state.rev.buildings, computeCoverage);
  }

  roadAccess(): Uint8Array {
    return this.cached(this.cache.roadAccess, this.state.rev.roads, computeRoadAccess);
  }

  pollution(): Float32Array {
    return this.cached(this.cache.pollution, this.state.rev.zones, computePollution);
  }

  private cached<T>(
    slot: { rev: number; value: T | undefined },
    rev: number,
    compute: (state: SimState) => T,
  ): T {
    if (slot.value === undefined || slot.rev !== rev) {
      slot.value = compute(this.state);
      slot.rev = rev;
    }
    return slot.value;
  }

  /**
   * Road along a straight line from the first point toward the second, snapped to the axis that
   * moved most. Existing road is free, water and buildings are skipped, forest is cleared for a fee.
   */
  planRoadLine(x0: number, y0: number, x1: number, y1: number): Plan {
    const end = snapToAxis({ x: x0, y: y0 }, { x: x1, y: y1 });
    const tiles = lineTiles(x0, y0, end.x, end.y);
    let cost = 0;
    const planned = tiles.map((tile): PlanTile => {
      const status: PlanStatus =
        this.state.terrain[tile] === Terrain.Water || this.state.buildingId[tile] !== -1
          ? 'blocked'
          : this.state.road[tile] === 1
            ? 'keep'
            : 'change';
      if (status === 'change') cost += this.price(ROAD_COST) + this.clearingFee(tile);
      return { x: xOf(tile), y: yOf(tile), status };
    });
    return this.checked(planned, cost, 'water');
  }

  placeRoadLine(x0: number, y0: number, x1: number, y1: number): CommandResult {
    return this.execute(this.planRoadLine(x0, y0, x1, y1), (tile) => {
      this.clearForest(tile);
      this.clearZone(tile);
      this.state.road[tile] = 1;
      this.state.rev.roads++;
    });
  }

  /** Paints a zone over a rectangle. Same zone is free; developed lots of another zone are blocked. */
  planZoneRect(zone: ZoneKind, x0: number, y0: number, x1: number, y1: number): Plan {
    let cost = 0;
    const planned = rectTiles(x0, y0, x1, y1).map((tile): PlanTile => {
      const s = this.state;
      const status: PlanStatus =
        s.terrain[tile] === Terrain.Water ||
        s.road[tile] === 1 ||
        s.buildingId[tile] !== -1 ||
        (s.zone[tile] !== zone && s.level[tile] > 0)
          ? 'blocked'
          : s.zone[tile] === zone
            ? 'keep'
            : 'change';
      if (status === 'change') cost += this.price(ZONE_COST) + this.clearingFee(tile);
      return { x: xOf(tile), y: yOf(tile), status };
    });
    return this.checked(planned, cost, 'occupied');
  }

  zoneRect(zone: ZoneKind, x0: number, y0: number, x1: number, y1: number): CommandResult {
    return this.execute(this.planZoneRect(zone, x0, y0, x1, y1), (tile) => {
      this.clearForest(tile);
      this.state.zone[tile] = zone;
      this.state.level[tile] = 0;
      this.state.occupancy[tile] = 0;
      this.state.rev.zones++;
    });
  }

  /** A service or decoration with its top-left footprint corner at (x, y). */
  planBuilding(kind: BuildingKind, x: number, y: number): Plan {
    const def = BUILDINGS[kind];
    const s = this.state;
    if (kind === 'townHall' && s.townHallId !== undefined) {
      return { tiles: [], cost: 0, error: 'already-built' };
    }
    const footprint = rectTiles(x, y, x + def.size - 1, y + def.size - 1);
    let cost = this.price(def.cost);
    const planned = footprint.map((tile): PlanTile => {
      const blocked =
        s.terrain[tile] === Terrain.Water ||
        s.road[tile] === 1 ||
        s.buildingId[tile] !== -1 ||
        s.level[tile] > 0;
      if (!blocked) cost += this.clearingFee(tile);
      return { x: xOf(tile), y: yOf(tile), status: blocked ? 'blocked' : 'change' };
    });
    if (planned.length < footprint.length || footprint.length < def.size * def.size) {
      return { tiles: planned, cost, error: 'out-of-bounds' };
    }
    if (planned.some((t) => t.status === 'blocked')) {
      return { tiles: planned, cost, error: 'occupied' };
    }
    if (kind !== 'townHall' && s.townHallId === undefined) {
      return { tiles: planned, cost, error: 'needs-town-hall' };
    }
    return this.priced(planned, cost);
  }

  placeBuilding(kind: BuildingKind, x: number, y: number): CommandResult {
    const plan = this.planBuilding(kind, x, y);
    if (plan.error) return { ok: false, reason: plan.error };
    const id = this.state.nextBuildingId++;
    this.state.buildings.set(id, { id, kind, x, y });
    if (kind === 'townHall') this.state.townHallId = id;
    const result = this.execute(plan, (tile) => {
      this.clearForest(tile);
      this.clearZone(tile);
      this.state.buildingId[tile] = id;
    });
    this.state.rev.buildings++;
    return result;
  }

  /** Clears road, zone, buildings and forest from a rectangle, for a flat fee per cleared tile. */
  planBulldozeRect(x0: number, y0: number, x1: number, y1: number): Plan {
    const s = this.state;
    const planned = rectTiles(x0, y0, x1, y1).map((tile): PlanTile => {
      const building = s.buildingId[tile] === -1 ? undefined : s.buildings.get(s.buildingId[tile]);
      const status: PlanStatus =
        building?.kind === 'townHall'
          ? 'blocked'
          : s.road[tile] === 1 ||
              s.zone[tile] !== Zone.None ||
              building !== undefined ||
              s.terrain[tile] === Terrain.Forest
            ? 'change'
            : 'keep';
      return { x: xOf(tile), y: yOf(tile), status };
    });
    const count = planned.filter((t) => t.status === 'change').length;
    if (planned.length === 0) return { tiles: planned, cost: 0, error: 'out-of-bounds' };
    if (count === 0) {
      const blocked = planned.some((t) => t.status === 'blocked');
      return { tiles: planned, cost: 0, error: blocked ? 'protected' : 'nothing-to-build' };
    }
    return this.priced(planned, count * this.price(BULLDOZE_COST));
  }

  bulldozeRect(x0: number, y0: number, x1: number, y1: number): CommandResult {
    return this.execute(this.planBulldozeRect(x0, y0, x1, y1), (tile) => {
      if (this.state.road[tile] === 1) {
        this.state.road[tile] = 0;
        this.state.rev.roads++;
      }
      this.clearZone(tile);
      this.removeBuilding(tile);
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

  /** Shared validation for tile-painting plans: needs a town hall, something to change, and funds. */
  private checked(tiles: PlanTile[], cost: number, allBlocked: CommandError): Plan {
    if (tiles.length === 0) return { tiles, cost, error: 'out-of-bounds' };
    if (this.state.townHallId === undefined) return { tiles, cost, error: 'needs-town-hall' };
    if (tiles.every((t) => t.status === 'blocked')) return { tiles, cost, error: allBlocked };
    if (!tiles.some((t) => t.status === 'change')) return { tiles, cost, error: 'nothing-to-build' };
    return this.priced(tiles, cost);
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

  private clearZone(tile: number): void {
    if (this.state.zone[tile] === Zone.None) return;
    this.state.zone[tile] = Zone.None;
    this.state.level[tile] = 0;
    this.state.occupancy[tile] = 0;
    this.state.rev.zones++;
  }

  private removeBuilding(tile: number): void {
    const id = this.state.buildingId[tile];
    if (id === -1) return;
    const building = this.state.buildings.get(id);
    if (!building) return;
    const size = BUILDINGS[building.kind].size;
    for (const t of rectTiles(building.x, building.y, building.x + size - 1, building.y + size - 1)) {
      this.state.buildingId[t] = -1;
    }
    this.state.buildings.delete(id);
    this.state.rev.buildings++;
  }
}
