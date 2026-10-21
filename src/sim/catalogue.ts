/** Prices at normal difficulty, before the cost multiplier. */
export const ROAD_COST = 10;
export const ROAD_UPKEEP = 1;
export const BULLDOZE_COST = 2;
export const ZONE_COST = 5;

export const SERVICES = ['power', 'water', 'park', 'school', 'clinic', 'fire', 'police', 'plaza'] as const;
export type Service = (typeof SERVICES)[number];

export const BUILDING_KINDS = [
  'townHall',
  'windTurbine',
  'waterTower',
  'park',
  'school',
  'clinic',
  'fireStation',
  'policeStation',
  'tree',
  'plaza',
] as const;
export type BuildingKind = (typeof BUILDING_KINDS)[number];

export type BuildingDef = {
  label: string;
  size: 1 | 2;
  cost: number;
  upkeep: number;
  /** Chebyshev coverage radius in tiles from any footprint tile. Zero for decoration. */
  radius: number;
  services: readonly Service[];
  jobs: number;
};

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  townHall: { label: 'Town hall', size: 2, cost: 0, upkeep: 0, radius: 6, services: SERVICES, jobs: 20 },
  windTurbine: { label: 'Wind turbine', size: 1, cost: 300, upkeep: 20, radius: 8, services: ['power'], jobs: 0 },
  waterTower: { label: 'Water tower', size: 1, cost: 250, upkeep: 15, radius: 8, services: ['water'], jobs: 0 },
  park: { label: 'Park', size: 1, cost: 100, upkeep: 5, radius: 4, services: ['park'], jobs: 0 },
  school: { label: 'School', size: 2, cost: 400, upkeep: 40, radius: 10, services: ['school'], jobs: 0 },
  clinic: { label: 'Clinic', size: 1, cost: 500, upkeep: 50, radius: 10, services: ['clinic'], jobs: 0 },
  fireStation: { label: 'Fire station', size: 1, cost: 450, upkeep: 40, radius: 10, services: ['fire'], jobs: 0 },
  policeStation: { label: 'Police station', size: 1, cost: 450, upkeep: 40, radius: 10, services: ['police'], jobs: 0 },
  tree: { label: 'Tree', size: 1, cost: 5, upkeep: 0, radius: 0, services: [], jobs: 0 },
  plaza: { label: 'Plaza', size: 1, cost: 60, upkeep: 2, radius: 2, services: ['plaza'], jobs: 0 },
};

export function isBuildingKind(value: string): value is BuildingKind {
  return (BUILDING_KINDS as readonly string[]).includes(value);
}
