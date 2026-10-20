import { describe, expect, it } from 'vitest';
import { CameraRig } from '../src/render/camera';

const settle = (rig: CameraRig): void => {
  for (let i = 0; i < 20; i++) rig.update(0.5);
};

describe('CameraRig', () => {
  it('rotates around four rail positions and wraps', () => {
    const rig = new CameraRig();
    rig.rotate(-1);
    expect(rig.rotationIndex).toBe(3);
    for (let i = 0; i < 4; i++) rig.rotate(1);
    expect(rig.rotationIndex).toBe(3);
  });

  it('snaps a drag to the nearest quarter turn and eases there without a jump', () => {
    const rig = new CameraRig();
    rig.resize(1600, 900);
    rig.dragYaw = 0.3;
    rig.update(0.001);
    const beforeX = rig.camera.position.x;
    rig.commitDrag();
    expect(rig.rotationIndex).toBe(0);
    expect(rig.dragYaw).toBe(0);
    rig.update(0.001);
    // Easing has barely started, so the camera is within a whisker of where the drag left it.
    expect(Math.abs(rig.camera.position.x - beforeX)).toBeLessThan(1);
    rig.dragYaw = Math.PI / 2 + 0.2;
    rig.commitDrag();
    expect(rig.rotationIndex).toBe(1);
  });

  it('keeps the ground under the cursor still while zooming, even with rapid wheel ticks', () => {
    const rig = new CameraRig();
    rig.resize(1600, 900);
    const anchor = { x: 0.5, y: 0.4 };
    const before = rig.groundPoint(anchor);
    for (let i = 0; i < 5; i++) {
      rig.zoomBy(0.8, anchor);
      rig.update(0.016);
    }
    settle(rig);
    const after = rig.groundPoint(anchor);
    expect(after?.x).toBeCloseTo(before?.x ?? NaN, 1);
    expect(after?.z).toBeCloseTo(before?.z ?? NaN, 1);
    expect(rig.zoom).toBeLessThan(20);
  });

  it('clamps zoom and keeps the target near the map', () => {
    const rig = new CameraRig();
    rig.resize(1600, 900);
    rig.zoomBy(0.01, { x: 0, y: 0 });
    settle(rig);
    expect(rig.zoom).toBe(6);
    rig.zoomBy(100, { x: 0, y: 0 });
    settle(rig);
    expect(rig.zoom).toBe(44);
    rig.pan(50, 50);
    expect(rig.target.x).toBeLessThanOrEqual(70);
    expect(rig.target.z).toBeGreaterThanOrEqual(-6);
  });

  it('pans so the ground tracks the pointer equally in both screen axes', () => {
    const rig = new CameraRig();
    rig.resize(1000, 1000);
    const p0 = rig.groundPoint({ x: 0, y: 0 });
    rig.pan(0.5, 0);
    const p1 = rig.groundPoint({ x: 0, y: 0 });
    rig.pan(0, 0.5);
    const p2 = rig.groundPoint({ x: 0, y: 0 });
    const sideways = p1?.distanceTo(p0 ?? p1) ?? 0;
    const forward = p2?.distanceTo(p1 ?? p2) ?? 0;
    // Half the view height sideways is zoom units; forward needs more ground to cover the same pixels.
    expect(sideways).toBeCloseTo(10, 3);
    expect(forward).toBeCloseTo(10 / Math.sin((35.264 * Math.PI) / 180), 2);
    // Projecting the moved point lands it a full half view away on screen in each axis.
    const ndc = rig.project(p0?.x ?? 0, p0?.z ?? 0);
    expect(ndc.x).toBeCloseTo(-0.5, 2);
    expect(ndc.y).toBeCloseTo(-0.5, 2);
  });
});
