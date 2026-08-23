import type { Page } from '@playwright/test';

/** Navigate to the app and wait for it to finish initialising. */
export async function gotoApp(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await page.waitForSelector('#grid');
}
