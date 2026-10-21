import type { Page } from '@playwright/test';

/** Loads the game with a query string and clicks through the start screen until the game object exists. */
export async function boot(page: Page, query = '', button = 'Found the town'): Promise<void> {
  await page.goto(`/${query}`);
  await page.getByRole('button', { name: button }).click();
  await page.waitForFunction(() => window.townlet !== undefined);
}
