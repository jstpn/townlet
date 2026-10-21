import { expect, test } from '@playwright/test';
import { boot } from './boot';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

type TouchPoint = { x: number; y: number; id: number };

test('two fingers pinch, drag and twist the camera; one finger lays road', async ({
  page,
  context,
}) => {
  await boot(page, '?seed=budapest');
  const cdp = await context.newCDPSession(page);
  const touch = (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: TouchPoint[],
  ): Promise<unknown> => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });

  const before = await page.evaluate(() => window.townlet.gfx.rig.pose());
  // Spread apart while sliding and turning a quarter.
  await touch('touchStart', [
    { x: 160, y: 420, id: 1 },
    { x: 230, y: 420, id: 2 },
  ]);
  for (let step = 1; step <= 8; step++) {
    const angle = (step / 8) * (Math.PI / 2);
    const r = 35 + step * 12;
    const cx = 195 + step * 6;
    const cy = 420 + step * 4;
    await touch('touchMove', [
      { x: cx - Math.cos(angle) * r, y: cy - Math.sin(angle) * r, id: 1 },
      { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, id: 2 },
    ]);
  }
  await touch('touchEnd', []);
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => window.townlet.gfx.rig.pose());
  expect(after.zoom).toBeLessThan(before.zoom * 0.7);
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.5);
  expect(after.rotation).not.toBe(before.rotation);
  expect(await page.evaluate(() => window.townlet.tool.preview)).toBeUndefined();

  // A single finger with the road tool drags a road, after the camera is put somewhere flat.
  await page.evaluate(() => {
    window.townlet.gfx.rig.setPose({ x: 32, z: 32, zoom: 8, rotation: 0 });
    window.townlet.sim.state.terrain.fill(2);
    window.townlet.sim.state.height.fill(0);
    window.townlet.sim.state.rev.terrain++;
    window.townlet.sim.placeBuilding('townHall', 30, 28);
    window.townlet.tool.setTool({ kind: 'road' });
  });
  const from = await page.evaluate(() => window.townlet.tileToScreen(30, 32));
  const to = await page.evaluate(() => window.townlet.tileToScreen(34, 32));
  await touch('touchStart', [{ ...from, id: 3 }]);
  await touch('touchMove', [{ ...to, id: 3 }]);
  await touch('touchEnd', []);
  await page.waitForTimeout(200);
  const roads = await page.evaluate(
    () => window.townlet.sim.state.road.filter((r) => r === 1).length,
  );
  expect(roads).toBe(5);
});
