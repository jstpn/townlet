import { test } from '@playwright/test';
import { CYCLE_DAYS, MIDNIGHT } from '../src/render/daylight';
import { SAVE_KEY, type SaveFile } from '../src/save';
import { snapshot } from '../src/sim/save';
import { autoplay } from '../tests/autoplayer';
import { boot } from './boot';

/** README pictures: a grown town in every palette, by day and night. Run with `npm run shots`. */
test('takes the README screenshots @shots', async ({ page }) => {
  const { sim, hall } = autoplay('normal', 'budapest', 26);
  // A whole number of light cycles in, so the first shots are in full day.
  sim.state.day = CYCLE_DAYS * 6;
  const save: SaveFile = {
    version: 1,
    sim: snapshot(sim),
    palette: 'budapest',
    camera: { x: hall.x + 1, z: hall.y + 3, zoom: 17, rotation: 0 },
  };
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify(save)],
  );
  const shot = (name: string): Promise<Buffer> =>
    page.screenshot({ path: `docs/screenshots/${name}.jpg`, type: 'jpeg', quality: 84 });
  await page.goto('/');
  await shot('start');
  await boot(page, '', 'Continue');
  await page.evaluate(() => {
    window.townlet.speed = 0;
  });
  await page.waitForTimeout(1500);
  await shot('hero');

  await page.addStyleTag({ content: '#hud { display: none !important; }' });
  for (const palette of ['moonrise', 'darjeeling', 'asteroid'] as const) {
    await page.evaluate((name) => {
      window.townlet.setPalette(name);
    }, palette);
    await page.waitForTimeout(600);
    await shot(palette);
  }
  await page.evaluate(
    ([days]) => {
      window.townlet.setPalette('budapest');
      window.townlet.sim.state.day += days;
    },
    [Math.round(MIDNIGHT * CYCLE_DAYS)],
  );
  await page.waitForTimeout(600);
  await shot('night');
});
