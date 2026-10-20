import { expect, test } from '@playwright/test';

test('boots and renders the scene', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await expect(page.locator('#scene')).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e/screenshots/boot.png' });
  expect(errors).toEqual([]);
});
