import { hashSeed } from '../sim/rng';

const FIRST = ['Little', 'Upper', 'East', 'New', 'Saint', 'Port', 'Old', 'High', 'North', 'Grand'];
const ROOT = [
  'Zissou',
  'Tenenbaum',
  'Whitman',
  'Rushmore',
  'Gustave',
  'Fox',
  'Bishop',
  'Moonrise',
  'Mendl',
  'Zubrowka',
  'Lebowitz',
  'Darjeeling',
];
const LAST = ['ford', 'ton', 'bury', 'wick', 'mouth', ' Bay', ' Hollow', ' Green', 'haven', ' Cross'];

/** A town name that the seed always maps to, so the postcard matches the town. */
export function townName(seed: string): string {
  const h = hashSeed(`${seed}:name`);
  const first = FIRST[h % FIRST.length];
  const root = ROOT[(h >>> 4) % ROOT.length];
  const last = LAST[(h >>> 9) % LAST.length];
  return (h >>> 14) % 3 === 0 ? `${first} ${root}${last}` : `${root}${last}`;
}
