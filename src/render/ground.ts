/** World-space height of one terrace level. */
export const STEP_Y = 0.4;

/** Ground height at a tile. */
export const groundY = (height: Uint8Array, tile: number): number => height[tile] * STEP_Y;
