import type { CameraPose } from './render/camera';
import { type PaletteName, isPaletteName } from './render/palette';
import { isDifficulty } from './sim/difficulty';
import { TILE_COUNT } from './sim/grid';
import type { SimSnapshot } from './sim/save';

const KEY = 'townlet:autosave';

export type SaveFile = { version: 1; sim: SimSnapshot; palette: PaletteName; camera: CameraPose };

export function writeSave(file: SaveFile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(file));
  } catch {
    // Private mode or a full quota: the game simply runs without an autosave.
  }
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}

/** The autosave, if there is one this build can read. */
export function readSave(): SaveFile | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const file = JSON.parse(raw) as Partial<SaveFile>;
    if (file.version !== 1 || file.sim?.terrain.length !== TILE_COUNT) return undefined;
    if (!isDifficulty(file.sim.difficulty) || !isPaletteName(file.palette ?? '')) return undefined;
    return file as SaveFile;
  } catch {
    return undefined;
  }
}
