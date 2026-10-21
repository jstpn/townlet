import { expect, test } from '@playwright/test';
import { snapshot } from '../src/sim/save';
import { autoplay } from '../tests/autoplayer';

/** README pictures: a grown town in every palette, by day and night. Run with `npm run shots`. */
test('takes the README screenshots @shots', async ({ page }) => {
  const { sim } = autoplay('normal', 'budapest', 26);
  // Day 720 is morning in the 120-day light cycle; 78 days later is the middle of the night.
  sim.state.day = 720;
  const hall = [...sim.state.buildings.values()].find((b) => b.kind === 'townHall');
  expect(hall).toBeDefined();
  const save = {
    version: 1,
    sim: snapshot(sim),
    palette: 'budapest',
    camera: { x: (hall?.x ?? 32) + 1, z: (hall?.y ?? 32) + 3, zoom: 17, rotation: 0 },
  };
  await page.addInitScript(
    (value) => localStorage.setItem('townlet:autosave', value),
    JSON.stringify(save),
  );
  await page.goto('/');
  const shot = (name: string): Promise<Buffer> =>
    page.screenshot({ path: `docs/screenshots/${name}.jpg`, type: 'jpeg', quality: 84 });
  await shot('start');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForFunction(() => window.townlet !== undefined);
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
  await page.evaluate(() => {
    window.townlet.setPalette('budapest');
    window.townlet.sim.state.day += 78;
  });
  await page.waitForTimeout(600);
  await shot('night');
});
