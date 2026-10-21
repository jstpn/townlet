import type * as THREE from 'three';
import type { SimState } from '../sim/sim';
import type { Palette } from './palette';

/** A drawable layer that rebuilds itself from sim revision counters and the palette. */
export type Layer = {
  readonly object: THREE.Object3D;
  /** Returns true when shadow-casting geometry changed this frame. */
  sync(state: SimState, palette: Palette): boolean;
  /** Per-frame motion in wall-clock seconds. Runs while paused, so the town never freezes. */
  animate?(dt: number): void;
};
