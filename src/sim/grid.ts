export const MAP_SIZE = 64;
export const TILE_COUNT = MAP_SIZE * MAP_SIZE;

export type Point = { x: number; y: number };

export function idx(x: number, y: number): number {
  return y * MAP_SIZE + x;
}

export function xOf(tile: number): number {
  return tile % MAP_SIZE;
}

export function yOf(tile: number): number {
  return (tile - (tile % MAP_SIZE)) / MAP_SIZE;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE;
}

/** The four orthogonal steps. */
export const DIRS4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** The eight surrounding steps. */
export const DIRS8: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/** Snaps a drag end point onto the axis that moved most, so the result is a straight line from `from`. */
export function snapToAxis(from: Point, to: Point): Point {
  return Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
    ? { x: to.x, y: from.y }
    : { x: from.x, y: to.y };
}

/** In-bounds tiles along an axis-aligned line, inclusive of both ends. */
export function lineTiles(x0: number, y0: number, x1: number, y1: number): number[] {
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

/** In-bounds tiles of the rectangle spanned by two corners, inclusive. */
export function rectTiles(x0: number, y0: number, x1: number, y1: number): number[] {
  const tiles: number[] = [];
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      if (inBounds(x, y)) tiles.push(idx(x, y));
    }
  }
  return tiles;
}

/** Size of the largest 4-connected set of tiles for which `passable` holds. */
export function largestRegionSize(passable: (tile: number) => boolean): number {
  return Math.max(0, ...labelRegions(passable).sizes);
}

/** Numbers every 4-connected region of passable tiles; `label` is -1 elsewhere. */
export function labelRegions(passable: (tile: number) => boolean): {
  label: Int32Array;
  sizes: number[];
} {
  const label = new Int32Array(TILE_COUNT).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < TILE_COUNT; start++) {
    if (label[start] !== -1 || !passable(start)) continue;
    const region = sizes.length;
    let size = 0;
    stack.push(start);
    label[start] = region;
    for (let tile = stack.pop(); tile !== undefined; tile = stack.pop()) {
      size++;
      const x = xOf(tile);
      const y = yOf(tile);
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const next = idx(nx, ny);
        if (label[next] !== -1 || !passable(next)) continue;
        label[next] = region;
        stack.push(next);
      }
    }
    sizes.push(size);
  }
  return { label, sizes };
}

export const UNREACHABLE = 0xffff;

/** 4-connected step distance from the nearest source tile; UNREACHABLE where no source connects. */
export function distanceField(isSource: (tile: number) => boolean): Uint16Array {
  const distance = new Uint16Array(TILE_COUNT).fill(UNREACHABLE);
  const queue: number[] = [];
  for (let tile = 0; tile < TILE_COUNT; tile++) {
    if (isSource(tile)) {
      distance[tile] = 0;
      queue.push(tile);
    }
  }
  // Pushing while iterating is deliberate: the array is the BFS queue.
  for (const tile of queue) {
    const x = xOf(tile);
    const y = yOf(tile);
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const next = idx(nx, ny);
      if (distance[next] !== UNREACHABLE) continue;
      distance[next] = distance[tile] + 1;
      queue.push(next);
    }
  }
  return distance;
}

/** v held within [lo, hi]. */
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
/** Modulo that stays in [0, n) for negative values too. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n;

const cameFrom = new Int32Array(TILE_COUNT);

/** Shortest route along road tiles from one road tile to another, inclusive, or undefined when disconnected. */
export function roadPath(road: Uint8Array, from: number, to: number): number[] | undefined {
  if (road[from] === 0 || road[to] === 0) return undefined;
  cameFrom.fill(-1);
  cameFrom[from] = from;
  const queue = [from];
  // Pushing while iterating is deliberate: the array is the BFS queue.
  for (const tile of queue) {
    if (tile === to) break;
    const x = xOf(tile);
    const y = yOf(tile);
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const next = idx(nx, ny);
      if (road[next] === 0 || cameFrom[next] !== -1) continue;
      cameFrom[next] = tile;
      queue.push(next);
    }
  }
  if (cameFrom[to] === -1) return undefined;
  const path: number[] = [];
  for (let tile = to; tile !== from; tile = cameFrom[tile]) path.push(tile);
  path.push(from);
  return path.reverse();
}
