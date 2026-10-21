export const Terrain = {
  Water: 0,
  Sand: 1,
  Grass: 2,
  Forest: 3,
} as const;
export type Terrain = (typeof Terrain)[keyof typeof Terrain];

export const Zone = {
  None: 0,
  Residential: 1,
  Commercial: 2,
  Industrial: 3,
} as const;
export type Zone = (typeof Zone)[keyof typeof Zone];
export type ZoneKind = Exclude<Zone, typeof Zone.None>;
export const ZONE_KINDS = [Zone.Residential, Zone.Commercial, Zone.Industrial] as const;
