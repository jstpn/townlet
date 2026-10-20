import { expect, test } from '@playwright/test';

test('boots, lays a road by dragging, and renders without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/?seed=budapest');
  await expect(page.locator('#scene')).toBeVisible();
  await page.waitForTimeout(400);

  await page.keyboard.press('1');
  await page.mouse.move(720, 450);
  await page.mouse.down();
  await page.mouse.move(900, 450, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const roads = await page.evaluate(() => {
    let n = 0;
    for (const r of window.townlet.sim.state.road) n += r;
    return n;
  });
  expect(roads).toBeGreaterThan(0);
  await page.screenshot({ path: 'e2e/screenshots/boot.png' });
  expect(errors).toEqual([]);
});
