export const MAP_SIZE = 64;
export const TILE_COUNT = MAP_SIZE * MAP_SIZE;

export function idx(x: number, y: number): number {
  return y * MAP_SIZE + x;
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

export type Region = {
  size: number;
  /** 1 where the tile belongs to the region. */
  mask: Uint8Array;
};

/** Largest 4-connected set of tiles for which `passable` holds. */
export function largestRegion(passable: (tile: number) => boolean): Region {
  const seen = new Uint8Array(TILE_COUNT);
  const stack: number[] = [];
  let best: Region = { size: 0, mask: new Uint8Array(TILE_COUNT) };
  for (let start = 0; start < TILE_COUNT; start++) {
    if (seen[start] || !passable(start)) continue;
    const mask = new Uint8Array(TILE_COUNT);
    let size = 0;
    stack.push(start);
    seen[start] = 1;
    for (let tile = stack.pop(); tile !== undefined; tile = stack.pop()) {
      mask[tile] = 1;
      size++;
      const x = tile % MAP_SIZE;
      const y = (tile - x) / MAP_SIZE;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const next = idx(nx, ny);
        if (seen[next] || !passable(next)) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    if (size > best.size) best = { size, mask };
  }
  return best;
}
