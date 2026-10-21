import { type Age, type Stock, affords, priceStock } from './ages';
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

export type AdvancementId = 'fire' | 'grindingStones';

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
  priceStock(ADVANCEMENTS[id].cost, state.difficulty);

/** Why research on `id` cannot start now, or undefined when it can. */
export function researchError(state: SimState, id: AdvancementId): CommandError | undefined {
  const def = ADVANCEMENTS[id];
  if (state.held.has(id)) return 'held';
  const standing = [...state.buildings.values()].some((b) => b.kind === def.standing);
  if (def.age !== state.age || !standing || def.needs.some((n) => !state.held.has(n)))
    return 'locked';
  if (state.research) return 'busy';
  return affords(state.stock, researchCost(state, id)) ? undefined : 'short';
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
