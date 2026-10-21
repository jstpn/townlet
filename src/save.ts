import type { CameraPose } from './render/camera';
import { type PaletteName, isPaletteName } from './render/palette';
import { AGES } from './sim/ages';
import { isDifficulty } from './sim/difficulty';
import { TILE_COUNT } from './sim/grid';
import { SNAPSHOT_GRIDS, type SimSnapshot } from './sim/save';

export const SAVE_KEY = 'townlet:autosave';

/** Bumped when a save's shape changes; older saves are ignored rather than migrated. */
export const SAVE_VERSION = 3;

export type SaveFile = {
  version: typeof SAVE_VERSION;
  sim: SimSnapshot;
  palette: PaletteName;
  camera: CameraPose;
};

export function writeSave(file: SaveFile): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(file));
  } catch {
    // Private mode or a full quota: the game simply runs without an autosave.
  }
}

/** A shape check, so a truncated or edited save is ignored rather than crashing the restore. */
function isSaveFile(file: Partial<SaveFile>): file is SaveFile {
  const sim = file.sim;
  if (file.version !== SAVE_VERSION || !sim || !isPaletteName(file.palette ?? '')) return false;
  if (!isDifficulty(sim.difficulty) || typeof sim.seed !== 'string') return false;
  if (!AGES.includes(sim.age)) return false;
  if (!Array.isArray(sim.buildings) || !Array.isArray(sim.announced)) return false;
  if (!Array.isArray(sim.held)) return false;
  return SNAPSHOT_GRIDS.every((key) => Array.isArray(sim[key]) && sim[key].length === TILE_COUNT);
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

/** The autosave, if there is one this build can read. */
export function readSave(): SaveFile | undefined {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return undefined;
    const file = JSON.parse(raw) as Partial<SaveFile>;
    return isSaveFile(file) ? file : undefined;
  } catch {
    return undefined;
  }
}
