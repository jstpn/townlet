/// <reference types="node" />
import process from 'node:process';
import { MAP_SIZE, idx } from '../src/sim/grid';
import { generateMap } from '../src/sim/mapgen';
import { Terrain } from '../src/sim/types';

const glyph: Record<number, string> = {
  [Terrain.Water]: '~',
  [Terrain.Sand]: '.',
  [Terrain.Grass]: ' ',
  [Terrain.Forest]: 'T',
};

for (const seed of process.argv.slice(2)) {
  const map = generateMap(seed);
  const counts = [0, 0, 0, 0];
  const rows: string[] = [];
  for (let y = 0; y < MAP_SIZE; y++) {
    let row = '';
    for (let x = 0; x < MAP_SIZE; x++) {
      const t = map.terrain[idx(x, y)] ?? 0;
      counts[t] = (counts[t] ?? 0) + 1;
      row += glyph[t] ?? '?';
    }
    rows.push(row);
  }
  const total = MAP_SIZE * MAP_SIZE;
  const pct = (n: number): string => `${((100 * n) / total).toFixed(0)}%`;
  console.log(
    `seed=${seed} water=${pct(counts[0] ?? 0)} sand=${pct(counts[1] ?? 0)} grass=${pct(counts[2] ?? 0)} forest=${pct(counts[3] ?? 0)}`,
  );
  console.log(rows.join('\n'));
}
