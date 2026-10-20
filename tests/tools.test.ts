import { describe, expect, it } from 'vitest';
import type { Pointer } from '../src/input/pointer';
import { BuildTool } from '../src/input/tools';
import type { CameraRig } from '../src/render/camera';
import type { Point } from '../src/sim/grid';
import { idx } from '../src/sim/grid';
import { Sim } from '../src/sim/sim';
import { Terrain } from '../src/sim/types';
import { flatTerrain } from './helpers';

/** Drives a BuildTool with a fake pointer and a camera that reports whatever tile we say. */
function harness() {
  const sim = new Sim({ seed: 't', difficulty: 'normal', terrain: flatTerrain(Terrain.Grass) });
  let under: Point | undefined;
  const handlers = {
    down: [] as ((b: number) => void)[],
    move: [] as (() => void)[],
    up: [] as ((b: number) => void)[],
  };
  const pointer = {
    inside: true,
    ndc: { x: 0, y: 0 },
    onDown: (h: (b: number) => void) => handlers.down.push(h),
    onMove: (h: () => void) => handlers.move.push(h),
    onUp: (h: (b: number) => void) => handlers.up.push(h),
  } as unknown as Pointer;
  const rig = { pickTile: () => under } as unknown as CameraRig;
  const tool = new BuildTool(sim, rig, pointer);
  return {
    sim,
    tool,
    pointer,
    hoverAt(tile: Point | undefined) {
      under = tile;
      for (const h of handlers.move) h();
    },
    /** The camera moved under a still pointer: no pointer event, just a frame. */
    cameraMovesTo(tile: Point | undefined) {
      under = tile;
      tool.update();
    },
    press(button = 0) {
      for (const h of handlers.down) h(button);
    },
    release(button = 0) {
      for (const h of handlers.up) h(button);
    },
  };
}

describe('BuildTool', () => {
  it('does nothing without a tool', () => {
    const h = harness();
    h.hoverAt({ x: 5, y: 5 });
    h.press();
    h.hoverAt({ x: 9, y: 5 });
    h.release();
    expect(h.tool.preview).toBeUndefined();
    expect(h.sim.state.road[idx(5, 5)]).toBe(0);
  });

  it('previews under the pointer as soon as a tool is chosen, even if the pointer moved while no tool was active', () => {
    const h = harness();
    h.hoverAt({ x: 2, y: 2 });
    h.tool.setTool({ kind: 'road' });
    h.tool.setTool({ kind: 'none' });
    h.hoverAt({ x: 7, y: 7 });
    h.tool.setTool({ kind: 'road' });
    expect(h.tool.preview?.plan.tiles).toEqual([{ x: 7, y: 7, status: 'change' }]);
  });

  it('commits exactly the line it previewed', () => {
    const h = harness();
    h.tool.setTool({ kind: 'road' });
    h.hoverAt({ x: 10, y: 10 });
    h.press();
    h.hoverAt({ x: 14, y: 11 });
    expect(h.tool.preview?.plan.tiles).toHaveLength(5);
    expect(h.tool.preview?.plan.cost).toBe(50);
    const money = h.sim.state.money;
    h.release();
    expect(h.sim.state.money).toBe(money - 50);
    for (let x = 10; x <= 14; x++) expect(h.sim.state.road[idx(x, 10)]).toBe(1);
    expect(h.tool.preview?.plan.tiles).toEqual([{ x: 14, y: 11, status: 'change' }]);
  });

  it('follows the camera when it moves under a still pointer, so preview and commit agree', () => {
    const h = harness();
    h.tool.setTool({ kind: 'road' });
    h.hoverAt({ x: 10, y: 10 });
    h.press();
    h.cameraMovesTo({ x: 20, y: 10 });
    expect(h.tool.preview?.plan.tiles).toHaveLength(11);
    h.release();
    let roads = 0;
    for (const r of h.sim.state.road) roads += r;
    expect(roads).toBe(11);
  });

  it('cancels a drag that ends off the map instead of charging for the start tile', () => {
    const h = harness();
    h.tool.setTool({ kind: 'road' });
    h.hoverAt({ x: 10, y: 10 });
    h.press();
    h.hoverAt(undefined);
    expect(h.tool.preview).toBeUndefined();
    const money = h.sim.state.money;
    h.release();
    expect(h.sim.state.money).toBe(money);
    expect(h.sim.state.road[idx(10, 10)]).toBe(0);
  });

  it('ignores other buttons and bulldozes a rectangle', () => {
    const h = harness();
    h.sim.placeRoadLine(3, 3, 6, 3);
    h.tool.setTool({ kind: 'bulldoze' });
    h.hoverAt({ x: 3, y: 3 });
    h.press(2);
    h.release(2);
    expect(h.sim.state.road[idx(3, 3)]).toBe(1);
    h.press();
    h.hoverAt({ x: 4, y: 4 });
    expect(h.tool.preview?.tint).toBe('remove');
    h.release();
    expect(h.sim.state.road[idx(3, 3)]).toBe(0);
    expect(h.sim.state.road[idx(4, 3)]).toBe(0);
    expect(h.sim.state.road[idx(5, 3)]).toBe(1);
  });
});
