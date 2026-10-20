export const Terrain = {
  Water: 0,
  Sand: 1,
  Grass: 2,
  Forest: 3,
} as const;
export type Terrain = (typeof Terrain)[keyof typeof Terrain];
