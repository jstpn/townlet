import { expect, test } from '@playwright/test';

test('boots, lays a road by dragging across land, and renders without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?seed=budapest');
  await expect(page.locator('#scene')).toBeVisible();
  await page.getByRole('button', { name: 'Found the town' }).click();
  await page.waitForFunction(() => window.townlet !== undefined);
  await page.waitForTimeout(400);

  // Find a run of five grass tiles near the middle of the map and its screen position.
  const target = await page.evaluate(() => {
    const { sim } = window.townlet;
    for (let y = 20; y < 44; y++) {
      for (let x = 20; x < 40; x++) {
        let clear = true;
        for (let i = 0; i < 5; i++) if (sim.state.terrain[y * 64 + x + i] !== 2) clear = false;
        if (clear) {
          return {
            x,
            y,
            from: window.townlet.tileToScreen(x, y),
            to: window.townlet.tileToScreen(x + 4, y),
          };
        }
      }
    }
    throw new Error('no grass run found');
  });

  // Found the town first: the hall is a 2x2 placed by clicking its top-left tile.
  await page.evaluate(({ x, y }) => {
    const { sim } = window.townlet;
    for (let yy = 0; yy < 64; yy++) {
      for (let xx = 0; xx < 64; xx++) {
        if (Math.abs(yy - y) < 3 && Math.abs(xx - x) < 7) continue;
        if (sim.placeBuilding('townHall', xx, yy).ok) return;
      }
    }
    throw new Error('nowhere to found the town');
  }, target);

  await page.keyboard.press('1');
  await page.mouse.move(target.from.x, target.from.y);
  await page.mouse.down();
  await page.mouse.move(target.to.x, target.to.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const laid = await page.evaluate(({ x, y }) => {
    const road = window.townlet.sim.state.road;
    const tiles: number[] = [];
    for (let i = 0; i < 5; i++) tiles.push(road[y * 64 + x + i] ?? 0);
    let total = 0;
    for (const r of road) total += r;
    return { tiles, total };
  }, target);
  expect(laid.tiles).toEqual([1, 1, 1, 1, 1]);
  expect(laid.total).toBe(5);

  await page.screenshot({ path: 'e2e/screenshots/boot.png' });
  expect(errors).toEqual([]);
});
