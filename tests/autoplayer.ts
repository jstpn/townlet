import {
  BUILDINGS,
  type BuildingKind,
  ROAD_COST,
  type Service,
  ZONE_COST,
} from '../src/sim/catalogue';
import type { Difficulty } from '../src/sim/difficulty';
import {
  MAP_SIZE,
  type Point,
  TILE_COUNT,
  idx,
  inBounds,
  labelRegions,
  mod,
  xOf,
  yOf,
} from '../src/sim/grid';
import { DAYS_PER_MONTH, Sim } from '../src/sim/sim';
import { Terrain, Zone, type ZoneKind } from '../src/sim/types';

const BLOCK = 5;
const RESERVE = 400;
/** Services in the order a sensible mayor buys them, with the building that provides each. */
const WANTS: [Service, BuildingKind][] = [
  ['power', 'windTurbine'],
  ['water', 'waterTower'],
  ['school', 'school'],
  ['clinic', 'clinic'],
  ['police', 'policeStation'],
  ['fire', 'fireStation'],
  ['park', 'park'],
];

export type Autoplay = {
  sim: Sim;
  hall: Point;
  wonAt: number | undefined;
  lostAt: number | undefined;
};

/**
 * A headless mayor: founds near the centre of the mainland, grows a road grid outward one ring a
 * month, zones 3:1:1 by block beside the roads, and buys services where coverage is missing.
 */
export function autoplay(difficulty: Difficulty, seed: string, months: number): Autoplay {
  const sim = new Sim({ seed, difficulty });
  const hall = foundTown(sim);
  if (!hall) throw new Error(`no room for a town hall on ${seed}`);
  let wonAt: number | undefined;
  let lostAt: number | undefined;
  let radius = 6;
  for (let month = 0; month < months; month++) {
    // Push the edge out once most of the homes zoned so far have been built on.
    if (developedShare(sim) > 0.6) radius = Math.min(30, radius + 1);
    expand(sim, hall, radius);
    for (let d = 0; d < DAYS_PER_MONTH; d++) sim.step();
    if (sim.state.status === 'won' && wonAt === undefined) wonAt = month + 1;
    if (sim.state.status === 'lost') {
      lostAt = month + 1;
      break;
    }
    if (wonAt !== undefined) break;
  }
  return { sim, hall, wonAt, lostAt };
}

/** Share of residential lots with something built on them. */
function developedShare(sim: Sim): number {
  const s = sim.state;
  let zoned = 0;
  let developed = 0;
  for (let tile = 0; tile < TILE_COUNT; tile++) {
    if (s.zone[tile] !== Zone.Residential) continue;
    zoned++;
    if (s.level[tile] > 0) developed++;
  }
  return zoned === 0 ? 1 : developed / zoned;
}

function foundTown(sim: Sim): Point | undefined {
  const terrain = sim.state.terrain;
  const { label, sizes } = labelRegions((tile) => terrain[tile] !== Terrain.Water);
  const mainland = sizes.indexOf(Math.max(...sizes));
  const centre = MAP_SIZE / 2;
  const candidates: number[] = [];
  for (let tile = 0; tile < TILE_COUNT; tile++) if (label[tile] === mainland) candidates.push(tile);
  candidates.sort((a, b) => dist(a, centre) - dist(b, centre));
  for (const tile of candidates) {
    const x = xOf(tile);
    const y = yOf(tile);
    if (sim.placeBuilding('townHall', x, y).ok) return { x, y };
  }
  return undefined;
}

const dist = (tile: number, c: number): number =>
  Math.hypot(xOf(tile) - c + 0.5, yOf(tile) - c + 0.5);

/** One month of mayoring within `radius` tiles of the hall. */
function expand(sim: Sim, hall: Point, radius: number): void {
  const s = sim.state;
  const gx = hall.x - 1;
  const gy = hall.y - 1;
  const onGrid = (v: number, g: number): boolean => (v - g) % BLOCK === 0;
  const x0 = Math.max(0, hall.x - radius);
  const y0 = Math.max(0, hall.y - radius);
  const x1 = Math.min(MAP_SIZE - 1, hall.x + radius);
  const y1 = Math.min(MAP_SIZE - 1, hall.y + radius);
  const afford = (cost: number): boolean => s.money - sim.price(cost) > RESERVE;

  // Roads: from every grid intersection, one block east and one south, so water only blocks its own stretch.
  for (let y = y0; y <= y1; y++) {
    if (!onGrid(y, gy)) continue;
    for (let x = x0; x <= x1; x++) {
      if (!onGrid(x, gx)) continue;
      if (x < x1 && afford(BLOCK * ROAD_COST)) sim.placeRoadLine(x, y, Math.min(x1, x + BLOCK), y);
      if (y < y1 && afford(BLOCK * ROAD_COST)) sim.placeRoadLine(x, y, x, Math.min(y1, y + BLOCK));
    }
  }

  // Zones: 3:1:1 by block, only on land within reach of a road.
  const access = sim.fields().roadAccess;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const tile = idx(x, y);
      // The sim refuses roads, buildings and water itself; only reach and price are the mayor's call.
      if (s.zone[tile] !== Zone.None || !access[tile] || !afford(ZONE_COST)) continue;
      const bx = Math.floor((x - gx) / BLOCK);
      const by = Math.floor((y - gy) / BLOCK);
      const k = mod(bx * 2 + by * 3, 5);
      const zone: ZoneKind = k < 3 ? Zone.Residential : k === 3 ? Zone.Commercial : Zone.Industrial;
      sim.zoneRect(zone, x, y, x, y);
    }
  }

  // Services: for each want, find a zoned tile without it and build the provider close by.
  let bought = 0;
  for (const [service, kind] of WANTS) {
    if (bought >= 3 || !afford(BUILDINGS[kind].cost)) continue;
    const coverage = sim.fields().coverage[service];
    const utility = service === 'power' || service === 'water';
    // Utilities go wherever a lot waits for them; the rest go where homes are zoned.
    const target = s.zone.findIndex(
      (zone, tile) => (utility ? zone !== Zone.None : zone === Zone.Residential) && !coverage[tile],
    );
    if (target < 0) continue;
    if (buildNear(sim, kind, xOf(target), yOf(target))) bought++;
  }
}

function buildNear(sim: Sim, kind: BuildingKind, cx: number, cy: number): boolean {
  for (let r = 1; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inBounds(cx + dx, cy + dy)) continue;
        const tile = idx(cx + dx, cy + dy);
        if (sim.state.zone[tile] !== Zone.None && sim.state.level[tile] > 0) continue;
        if (sim.placeBuilding(kind, cx + dx, cy + dy).ok) return true;
      }
    }
  }
  return false;
}
