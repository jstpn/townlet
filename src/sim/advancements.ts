import { type Age, RESOURCES, type Stock, scaleStock } from './ages';
import type { BuildingKind } from './catalogue';
import { DIFFICULTY } from './difficulty';
import type { CommandError, SimState } from './sim';

/** Days a research takes at normal difficulty, before the difficulty's multiplier. Tune. */
export const RESEARCH_DAYS = 30;

export type AdvancementDef = {
  label: string;
  age: Age;
  /** Advancements held first. */
  needs: readonly AdvancementId[];
  /** A building that must be standing. */
  standing: BuildingKind;
  cost: Stock;
};

export const ADVANCEMENT_IDS = ['fire', 'grindingStones'] as const;
export type AdvancementId = (typeof ADVANCEMENT_IDS)[number];

export const ADVANCEMENTS: Record<AdvancementId, AdvancementDef> = {
  fire: { label: 'Fire', age: 'forager', needs: [], standing: 'camp', cost: { wood: 10 } },
  grindingStones: {
    label: 'Grinding stones',
    age: 'forager',
    needs: ['fire'],
    standing: 'gatheringHut',
    cost: { stone: 20 },
  },
};

/** The advancement's price at this difficulty. */
export const researchCost = (state: SimState, id: AdvancementId): Stock =>
  scaleStock(ADVANCEMENTS[id].cost, DIFFICULTY[state.difficulty].costMultiplier);

/** Why research on `id` cannot start now, or undefined when it can. */
export function researchError(state: SimState, id: AdvancementId): CommandError | undefined {
  const def = ADVANCEMENTS[id];
  if (state.held.has(id)) return 'held';
  const standing = [...state.buildings.values()].some((b) => b.kind === def.standing);
  if (def.age !== state.age || !standing || def.needs.some((n) => !state.held.has(n)))
    return 'locked';
  if (state.research) return 'busy';
  const cost = researchCost(state, id);
  if (RESOURCES.some((r) => (cost[r] ?? 0) > (state.stock[r] ?? 0))) return 'short';
  return undefined;
}

/** Days a research takes at this difficulty. */
export const researchDays = (state: SimState): number =>
  Math.round(RESEARCH_DAYS * DIFFICULTY[state.difficulty].researchMultiplier);

/** Counts the research in progress down by a day. Returns the advancement completed today, if any. */
export function stepResearch(state: SimState): AdvancementId | undefined {
  const research = state.research;
  if (!research) return undefined;
  research.daysLeft--;
  if (research.daysLeft > 0) return undefined;
  state.held.add(research.id);
  state.research = null;
  return research.id;
}
