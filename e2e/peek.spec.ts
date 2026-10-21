import { test } from '@playwright/test';
import { CYCLE_DAYS } from '../src/render/daylight';
import type { PaletteName } from '../src/render/palette';
import { SAVE_KEY, SAVE_VERSION, type SaveFile } from '../src/save';
import { snapshot } from '../src/sim/save';
import { autoplay } from '../tests/autoplayer';
import { boot, enter } from './boot';

/**
 * One screenshot of the running game, for checking a change by eye. Run with `npm run peek` and
 * environment variables, all optional:
 *   OUT=path.jpg       where the picture goes (default e2e/screenshots/peek.jpg)
 *   SEED=budapest      map seed
 *   GROWN=26           autoplay a town for that many months first, instead of a fresh island
 *   DAY=0.65           time of day as a fraction of the light cycle: 0 is noon, 0.65 midnight
 *   POSE=x,z,zoom,rot  camera pose
 *   PALETTE=moonrise   palette name
 *   MOBILE=1           phone viewport with touch
 *   HUD=0              hide the HUD
 *   EVAL="..."         JavaScript run in the page before the shot, with `townlet` in scope,
 *                      e.g. EVAL="townlet.sim.placeRoadLine(20, 20, 30, 20)"
 */
const env = process.env;
if (env.MOBILE) test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

test('peek @peek', async ({ page }) => {
  const seed = env.SEED ?? 'budapest';
  const months = Number(env.GROWN ?? 0);
  if (months > 0) {
    const { sim, hall } = autoplay('normal', seed, months);
    sim.state.day = CYCLE_DAYS * 6;
    const save: SaveFile = {
      version: SAVE_VERSION,
      sim: snapshot(sim),
      palette: 'budapest',
      camera: { x: hall.x + 1, z: hall.y + 3, zoom: 17, rotation: 0 },
    };
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [SAVE_KEY, JSON.stringify(save)],
    );
    await page.goto('/');
    await enter(page, 'Continue');
  } else {
    await boot(page, `?seed=${seed}`);
  }
  const pose = env.POSE?.split(',').map(Number);
  const dayShift = env.DAY === undefined ? 0 : Math.round(Number(env.DAY) * CYCLE_DAYS);
  await page.evaluate(
    ([pose, dayShift, palette]) => {
      const g = window.townlet;
      g.speed = 0;
      if (pose) g.gfx.rig.setPose({ x: pose[0], z: pose[1], zoom: pose[2], rotation: pose[3] });
      g.sim.state.day += dayShift;
      if (palette) g.setPalette(palette);
    },
    [pose, dayShift, env.PALETTE as PaletteName | undefined] as const,
  );
  if (env.EVAL) await page.evaluate(env.EVAL);
  if (env.HUD === '0') await page.addStyleTag({ content: '#hud { display: none !important; }' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: env.OUT ?? 'e2e/screenshots/peek.jpg', type: 'jpeg', quality: 80 });
});
