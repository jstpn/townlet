import {
  type AdvancementId,
  researchCost,
  researchDays,
  researchError,
  stepResearch,
} from './advancements';
import { AGE_DEFS, type Age, RESOURCES, type Stock, computeCaps, scaleStock } from './ages';
import {
  BUILDINGS,
  BULLDOZE_COST,
  ROAD_COST,
  ZONE_COST,
  type BuildingKind,
  footprint,
} from './catalogue';
import { DIFFICULTY, type Difficulty, type DifficultySettings } from './difficulty';
import { type Budget, computeHappiness, settleMonth } from './economy';
import { type Coverage, computeCoverage, computePollution, computeRoadAccess } from './fields';
import { ignite, monthlyFire, stepFire } from './fire';
import {
  TILE_COUNT,
  clamp,
  idx,
  inBounds,
  lineTiles,
  rectTiles,
  snapToAxis,
  xOf,
  yOf,
} from './grid';
import { type Demand, type Fields, computeDemand, stepGrowth } from './growth';
import { generateMap } from './mapgen';
import { stepPeople } from './people';
import { type Rng, createRng } from './rng';
import { Terrain, Zone, type ZoneKind } from './types';

export type SimOptions = {
  seed: string;
  difficulty: Difficulty;
  /** The age the town starts in. The Motor city, the v1 game, until the start screen offers ages. */
  age?: Age;
  /** Override the generated map, for tests. */
  terrain?: Uint8Array;
  /** Override the starting money, for tests. */
  money?: number;
  /** Resume the random sequence from a save. */
  rngState?: number;
};

export type CommandError =
  | 'out-of-bounds'
  | 'water'
  | 'occupied'
  | 'insufficient-funds'
  | 'nothing-to-build'
  | 'needs-town-hall'
  | 'uneven'
  | 'already-built'
  | 'protected'
  | 'wrong-age'
  | 'short'
  | 'locked'
  | 'busy'
  | 'held';

export type CommandResult = { ok: true; cost: number } | { ok: false; reason: CommandError };

export type PlanStatus = 'change' | 'keep' | 'blocked';

/** One tile of a planned command: `change` tiles will be altered, `keep` stays as is, `blocked` cannot. */
export type PlanTile = { x: number; y: number; status: PlanStatus };

/** What a command would do, priced in coin and materials, so the UI can preview it before committing. */
export type Plan = { tiles: PlanTile[]; cost: number; materials?: Stock; error?: CommandError };

export type Building = {
  id: number;
  kind: BuildingKind;
  x: number;
  y: number;
  /** Residents in its slots today, and what it made today over the cap. */
  workers: number;
  wasted: number;
};

export type GameStatus = 'playing' | 'won' | 'lost';

/** Something worth telling the player about, drained by the HUD with `takeEvents`. */
export type SimEvent =
  | { kind: 'founded' }
  | { kind: 'service'; building: BuildingKind }
  | { kind: 'population'; count: number }
  | { kind: 'won' }
  | { kind: 'lost' }
  | { kind: 'fire'; x: number; y: number }
  | { kind: 'advanced'; id: AdvancementId };

export const DAYS_PER_MONTH = 30;
export const POPULATION_MILESTONES = [100, 500, 1000, 2500, 5000, 10000];
export const MAX_TAX_RATE = 20;

export type SimState = {
  seed: string;
  difficulty: Difficulty;
  age: Age;
  day: number;
  /** The treasury, coin. */
  money: number;
  stock: Stock;
  /** Advancements completed, and the one being researched. */
  held: Set<AdvancementId>;
  research: { id: AdvancementId; daysLeft: number } | null;
  terrain: Uint8Array;
  /** Terrace level per tile, 0 to 2. Never changes after generation. */
  height: Uint8Array;
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
  /** True once the town hall stands; nothing else may be built before it. */
  founded: boolean;
  /** Days a developed lot has sat near-empty with negative demand, and days it has been undesirable. */
  starveDays: Uint8Array;
  blightDays: Uint8Array;
  /** Days of burning left on each tile; 0 is not burning. */
  fire: Uint8Array;
  /** Residents. Counted from the lots in the Motor city, kept by the people engine before it. */
  population: number;
  /** Days toward the next arrival, consecutive days of hunger, days toward the next departure. */
  arrivalWait: number;
  hungerDays: number;
  leaveWait: number;
  jobs: number;
  demand: Demand;
  /** 0 to 100. Computed daily; lots empty out below the difficulty's leave threshold. */
  happiness: number;
  /** Percent, 0 to 20. */
  taxRate: number;
  /** Last month's settlement. */
  budget: Budget;
  status: GameStatus;
  /** Milestones already announced, so each shows once. */
  announced: Set<string>;
  /**
   * Bumped whenever the matching layer changes, so renderers know what to rebuild. `save` counts
   * the moments worth an autosave: a command, a tax change, a month settled.
   */
  rev: {
    terrain: number;
    roads: number;
    zones: number;
    buildings: number;
    fire: number;
    save: number;
  };
};

/** The whole town simulation: state plus the commands that change it. Deterministic, no DOM. */
export class Sim {
  readonly state: SimState;
  private readonly rng: Rng;
  private events: SimEvent[] = [];
  private readonly cache = {
    coverage: { rev: -1, value: undefined as Coverage | undefined },
    roadAccess: { rev: -1, value: undefined as Uint8Array | undefined },
    pollution: { rev: -1, value: undefined as Float32Array | undefined },
    caps: { rev: -1, value: undefined as Stock | undefined },
  };

  constructor(options: SimOptions) {
    const settings = DIFFICULTY[options.difficulty];
    const age = options.age ?? 'motor';
    this.rng = createRng(options.seed + ':sim', options.rngState);
    const map = options.terrain
      ? { terrain: options.terrain, height: new Uint8Array(TILE_COUNT) }
      : generateMap(options.seed);
    this.state = {
      seed: options.seed,
      difficulty: options.difficulty,
      age,
      day: 0,
      money: options.money ?? (AGE_DEFS[age].coin ? settings.startingMoney : 0),
      stock: scaleStock(AGE_DEFS[age].caps, settings.startingStock),
      held: new Set(),
      research: null,
      terrain: map.terrain,
      height: map.height,
      road: new Uint8Array(TILE_COUNT),
      zone: new Uint8Array(TILE_COUNT),
      level: new Uint8Array(TILE_COUNT),
      occupancy: new Float32Array(TILE_COUNT),
      buildingId: new Int32Array(TILE_COUNT).fill(-1),
      buildings: new Map(),
      nextBuildingId: 1,
      founded: false,
      starveDays: new Uint8Array(TILE_COUNT),
      blightDays: new Uint8Array(TILE_COUNT),
      fire: new Uint8Array(TILE_COUNT),
      population: 0,
      arrivalWait: 0,
      hungerDays: 0,
      leaveWait: 0,
      jobs: 0,
      demand: { 1: 0, 2: 0, 3: 0 },
      happiness: 100,
      taxRate: 10,
      budget: { income: 0, expenses: 0, taxes: { 1: 0, 2: 0, 3: 0 }, upkeep: {} },
      status: 'playing',
      announced: new Set(),
      rev: { terrain: 0, roads: 0, zones: 0, buildings: 0, fire: 0, save: 0 },
    };
  }

  /** Random sequence position, for saving. */
  get rngState(): number {
    return this.rng.state();
  }

  /** Advances one game day: the people engine, or demand, growth and the budget in the Motor city. */
  step(): void {
    const s = this.state;
    if (s.status === 'lost' || !s.founded) return;
    const settings = DIFFICULTY[s.difficulty];
    s.day++;
    if (s.age === 'motor') this.stepMotor(settings);
    else if (stepPeople(s, this.roadAccess(), this.caps(), settings)) this.lose();
    const advanced = stepResearch(s);
    if (advanced) {
      this.events.push({ kind: 'advanced', id: advanced });
      s.rev.save++;
    }
    if (s.day % DAYS_PER_MONTH === 0) s.rev.save++;
    for (const count of POPULATION_MILESTONES) {
      if (s.population >= count)
        this.announce(`population:${count}`, { kind: 'population', count });
    }
    if (s.population >= settings.winTarget && this.announce('won', { kind: 'won' }))
      s.status = 'won';
    if (settings.debtLimit !== undefined && s.money < settings.debtLimit) this.lose();
  }

  /** The v1 day, until build step 8 folds it onto the people engine. */
  private stepMotor(settings: DifficultySettings): void {
    const s = this.state;
    Object.assign(s, computeDemand(s));
    const fields = this.fields();
    s.happiness = computeHappiness(s, fields);
    if (stepGrowth(s, fields, this.rng, settings)) s.rev.zones++;
    this.burn(fields);
    if (s.day % DAYS_PER_MONTH === 0) {
      s.budget = settleMonth(s, settings);
      s.money += s.budget.income - s.budget.expenses;
      const started = monthlyFire(s, fields, this.rng, settings);
      if (started !== undefined)
        this.events.push({ kind: 'fire', x: xOf(started), y: yOf(started) });
    }
  }

  private lose(): void {
    this.state.status = 'lost';
    this.announce('lost', { kind: 'lost' });
  }

  /** Sets fire to a developed lot or a service. For tests and the odd act of arson. */
  ignite(x: number, y: number): boolean {
    if (!inBounds(x, y)) return false;
    const tile = idx(x, y);
    if (!ignite(this.state, this.fields(), tile)) return false;
    this.events.push({ kind: 'fire', x, y });
    return true;
  }

  /** Fire spreads, counts down and razes what burnt out. */
  private burn(fields: Fields): void {
    for (const tile of stepFire(this.state, fields, this.rng)) {
      if (this.state.buildingId[tile] !== -1) this.removeBuilding(tile);
      else this.razeLot(tile);
    }
  }

  /** Pays for an advancement of the age and starts researching it. */
  startResearch(id: AdvancementId): CommandResult {
    const s = this.state;
    const error = researchError(s, id);
    if (error) return { ok: false, reason: error };
    const cost = researchCost(s, id);
    for (const [r, amount] of Object.entries(cost) as [keyof Stock, number][])
      s.stock[r] = (s.stock[r] ?? 0) - amount;
    s.research = { id, daysLeft: researchDays(s) };
    s.rev.save++;
    return { ok: true, cost: 0 };
  }

  setTaxRate(rate: number): void {
    this.state.taxRate = clamp(Math.round(rate), 0, MAX_TAX_RATE);
    this.state.rev.save++;
  }

  /** Returns and clears the events raised since the last call. */
  takeEvents(): SimEvent[] {
    if (this.events.length === 0) return this.events;
    const events = this.events;
    this.events = [];
    return events;
  }

  /** Raises an event the first time its key is seen. Returns true when it was new. */
  private announce(key: string, event: SimEvent): boolean {
    if (this.state.announced.has(key)) return false;
    this.state.announced.add(key);
    this.events.push(event);
    return true;
  }

  /** The derived grids growth and the info panel read, each cached on its revision counter. */
  fields(): Fields {
    return {
      coverage: this.coverage(),
      roadAccess: this.roadAccess(),
      pollution: this.pollution(),
    };
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

  /** How much of each resource the town can hold. */
  caps(): Stock {
    return this.cached(this.cache.caps, this.state.rev.buildings, computeCaps);
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
   * moved most. Existing road is free; water, buildings and developed lots are skipped; forest is
   * cleared for a fee.
   */
  planRoadLine(x0: number, y0: number, x1: number, y1: number): Plan {
    const end = snapToAxis({ x: x0, y: y0 }, { x: x1, y: y1 });
    const tiles = lineTiles(x0, y0, end.x, end.y);
    let cost = 0;
    let water = false;
    const planned = tiles.map((tile): PlanTile => {
      water ||= this.state.terrain[tile] === Terrain.Water;
      const status: PlanStatus =
        this.state.road[tile] === 1
          ? 'keep'
          : this.occupied(tile) || this.state.level[tile] > 0
            ? 'blocked'
            : 'change';
      if (status === 'change') cost += this.price(ROAD_COST) + this.clearingFee(tile);
      return { x: xOf(tile), y: yOf(tile), status };
    });
    return this.checked(planned, cost, water ? 'water' : 'occupied');
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
    if (!AGE_DEFS[this.state.age].zones) return { tiles: [], cost: 0, error: 'wrong-age' };
    let cost = 0;
    const planned = rectTiles(x0, y0, x1, y1).map((tile): PlanTile => {
      const s = this.state;
      const status: PlanStatus =
        this.occupied(tile) || (s.zone[tile] !== zone && s.level[tile] > 0)
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
      this.setZone(tile, zone);
    });
  }

  /** One of the age's buildings with its top-left footprint corner at (x, y). */
  planBuilding(kind: BuildingKind, x: number, y: number): Plan {
    const def = BUILDINGS[kind];
    const s = this.state;
    const age = AGE_DEFS[s.age];
    if (!age.buildings.includes(kind)) return { tiles: [], cost: 0, error: 'wrong-age' };
    if (kind === age.main && s.founded) return { tiles: [], cost: 0, error: 'already-built' };
    let cost = this.price(def.cost);
    const planned = footprint({ kind, x, y }).map((tile): PlanTile => {
      const blocked = this.occupied(tile) || s.level[tile] > 0;
      if (!blocked) cost += this.clearingFee(tile);
      return { x: xOf(tile), y: yOf(tile), status: blocked ? 'blocked' : 'change' };
    });
    if (planned.length < def.size * def.size)
      return { tiles: planned, cost, error: 'out-of-bounds' };
    if (planned.some((t) => t.status === 'blocked'))
      return { tiles: planned, cost, error: 'occupied' };
    if (planned.some((t) => s.height[idx(t.x, t.y)] !== s.height[idx(x, y)]))
      return { tiles: planned, cost, error: 'uneven' };
    if (kind !== age.main && !s.founded) return { tiles: planned, cost, error: 'needs-town-hall' };
    const materials = scaleStock(def.materials ?? {}, DIFFICULTY[s.difficulty].costMultiplier);
    return this.priced(planned, cost, materials);
  }

  placeBuilding(kind: BuildingKind, x: number, y: number): CommandResult {
    const plan = this.planBuilding(kind, x, y);
    if (plan.error) return { ok: false, reason: plan.error };
    const id = this.state.nextBuildingId++;
    const main = kind === AGE_DEFS[this.state.age].main;
    this.state.buildings.set(id, { id, kind, x, y, workers: 0, wasted: 0 });
    if (main) this.state.founded = true;
    const result = this.execute(plan, (tile) => {
      this.clearForest(tile);
      this.clearZone(tile);
      this.state.buildingId[tile] = id;
    });
    this.state.rev.buildings++;
    if (main) this.announce('founded', { kind: 'founded' });
    else if (BUILDINGS[kind].services.length > 0) {
      this.announce(`service:${kind}`, { kind: 'service', building: kind });
    }
    return result;
  }

  /**
   * Clears road, zone, buildings and forest from a rectangle, for a flat fee per cleared tile.
   * A building clipped by the rectangle goes entirely, and its whole footprint is in the plan.
   */
  planBulldozeRect(x0: number, y0: number, x1: number, y1: number): Plan {
    const s = this.state;
    const planned = new Map<number, PlanTile>();
    const plan = (tile: number, status: PlanStatus): void => {
      if (planned.get(tile)?.status !== 'change') {
        planned.set(tile, { x: xOf(tile), y: yOf(tile), status });
      }
    };
    for (const tile of rectTiles(x0, y0, x1, y1)) {
      const building = s.buildingId[tile] === -1 ? undefined : s.buildings.get(s.buildingId[tile]);
      if (building?.kind === AGE_DEFS[s.age].main) plan(tile, 'blocked');
      else if (building) for (const t of footprint(building)) plan(t, 'change');
      else if (
        s.road[tile] === 1 ||
        s.zone[tile] !== Zone.None ||
        s.terrain[tile] === Terrain.Forest
      )
        plan(tile, 'change');
      else plan(tile, 'keep');
    }
    return this.bulldozePlan([...planned.values()]);
  }

  private bulldozePlan(planned: PlanTile[]): Plan {
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
      this.extinguish(tile);
    });
  }

  /** What a base price in coin costs at this difficulty; nothing in an age before coin. */
  price(base: number): number {
    if (!AGE_DEFS[this.state.age].coin) return 0;
    return Math.round(base * DIFFICULTY[this.state.difficulty].costMultiplier);
  }

  private clearingFee(tile: number): number {
    return this.state.terrain[tile] === Terrain.Forest ? this.price(BULLDOZE_COST) : 0;
  }

  private priced(tiles: PlanTile[], cost: number, materials?: Stock): Plan {
    if (cost > 0 && cost > this.state.money) return { tiles, cost, error: 'insufficient-funds' };
    if (!materials) return { tiles, cost };
    const short = RESOURCES.some((r) => (materials[r] ?? 0) > (this.state.stock[r] ?? 0));
    return short ? { tiles, cost, materials, error: 'short' } : { tiles, cost, materials };
  }

  /** Shared validation for tile-painting plans: needs a town hall, something to change, and funds. */
  private checked(tiles: PlanTile[], cost: number, allBlocked: CommandError): Plan {
    if (tiles.length === 0) return { tiles, cost, error: 'out-of-bounds' };
    if (!this.state.founded) return { tiles, cost, error: 'needs-town-hall' };
    if (tiles.every((t) => t.status === 'blocked')) return { tiles, cost, error: allBlocked };
    if (!tiles.some((t) => t.status === 'change'))
      return { tiles, cost, error: 'nothing-to-build' };
    return this.priced(tiles, cost);
  }

  /** Charges for a plan and applies it to every changing tile. Plans with an error change nothing. */
  private execute(plan: Plan, apply: (tile: number) => void): CommandResult {
    if (plan.error) return { ok: false, reason: plan.error };
    this.state.money -= plan.cost;
    for (const r of RESOURCES) {
      const amount = plan.materials?.[r];
      if (amount) this.state.stock[r] = (this.state.stock[r] ?? 0) - amount;
    }
    for (const t of plan.tiles) {
      if (t.status === 'change' && inBounds(t.x, t.y)) apply(idx(t.x, t.y));
    }
    this.state.rev.save++;
    return { ok: true, cost: plan.cost };
  }

  private clearForest(tile: number): void {
    if (this.state.terrain[tile] !== Terrain.Forest) return;
    this.state.terrain[tile] = Terrain.Grass;
    this.state.rev.terrain++;
  }

  /** Water, road or building: nothing else goes here. */
  private occupied(tile: number): boolean {
    const s = this.state;
    return s.terrain[tile] === Terrain.Water || s.road[tile] === 1 || s.buildingId[tile] !== -1;
  }

  private setZone(tile: number, zone: Zone): void {
    if (this.state.zone[tile] === zone) return;
    this.state.zone[tile] = zone;
    this.razeLot(tile);
  }

  private extinguish(tile: number): void {
    if (this.state.fire[tile] === 0) return;
    this.state.fire[tile] = 0;
    this.state.rev.fire++;
  }

  /** Back to an empty lot of the same zone. */
  private razeLot(tile: number): void {
    this.state.level[tile] = 0;
    this.state.occupancy[tile] = 0;
    this.state.rev.zones++;
  }

  private clearZone(tile: number): void {
    this.setZone(tile, Zone.None);
  }

  private removeBuilding(tile: number): void {
    const id = this.state.buildingId[tile];
    if (id === -1) return;
    const building = this.state.buildings.get(id);
    if (!building) return;
    for (const t of footprint(building)) this.state.buildingId[t] = -1;
    this.state.buildings.delete(id);
    this.state.rev.buildings++;
  }
}
