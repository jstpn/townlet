import { BUILDINGS, type BuildingKind } from './catalogue';
import type { SimState } from './sim';

/** The ages built so far, earliest first. Each build step adds the next (tasks/spec.md section 17). */
export const AGES = ['forager', 'motor'] as const;
export type Age = (typeof AGES)[number];

export const RESOURCES = ['food', 'wood', 'stone'] as const;
export type Resource = (typeof RESOURCES)[number];
/** An amount of each resource; a missing one is zero. */
export type Stock = Partial<Record<Resource, number>>;

export type AgeDef = {
  label: string;
  /** Resources kept and shown in this age, at most five. Coin is `money`, outside the stock. */
  resources: readonly Resource[];
  /** Caps the main building gives before any storage. */
  caps: Stock;
  /** Placed first; founds the town. */
  main: BuildingKind;
  /** What the build menu offers. */
  buildings: readonly BuildingKind[];
  /** Whether coin exists: prices in coin are free without it. */
  coin: boolean;
  zones: boolean;
};

export const AGE_DEFS: Record<Age, AgeDef> = {
  forager: {
    label: 'Forager camp',
    resources: ['food', 'wood', 'stone'],
    caps: { food: 60, wood: 40, stone: 40 },
    main: 'camp',
    buildings: ['camp', 'tent', 'gatheringHut', 'woodcutter', 'dryingRack'],
    coin: false,
    zones: false,
  },
  motor: {
    label: 'Motor city',
    resources: [],
    caps: {},
    main: 'townHall',
    buildings: [
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
    ],
    coin: true,
    zones: true,
  },
};

/** Each resource of `stock` scaled and rounded, dropping zeros. */
export function scaleStock(stock: Stock, by: number): Stock {
  const out: Stock = {};
  for (const r of RESOURCES) {
    const amount = Math.round((stock[r] ?? 0) * by);
    if (amount > 0) out[r] = amount;
  }
  return out;
}

/** The age's base caps plus the caps of every standing building. */
export function computeCaps(state: SimState): Stock {
  const caps = { ...AGE_DEFS[state.age].caps };
  for (const b of state.buildings.values()) {
    for (const [r, amount] of Object.entries(BUILDINGS[b.kind].caps ?? {}) as [Resource, number][])
      caps[r] = (caps[r] ?? 0) + amount;
  }
  return caps;
}
