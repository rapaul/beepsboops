import type { Page } from '@playwright/test';

/**
 * Navigate to the app and clear the "tap to enable sound" overlay, which sits
 * over everything until the first gesture.
 */
export async function gotoApp(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await page.waitForSelector('#grid');
  await dismissAudioUnlock(page);
}

export async function dismissAudioUnlock(page: Page): Promise<void> {
  const overlay = page.locator('.audio-unlock-overlay');
  if (await overlay.count()) {
    await overlay.dispatchEvent('pointerdown');
    await overlay.waitFor({ state: 'detached' });
  }
}
