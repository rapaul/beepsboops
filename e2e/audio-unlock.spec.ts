import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

/** Track every AudioContext the page builds, and pin it to the iOS shape. */
async function instrumentAudio(page: import('@playwright/test').Page, opts: { stallResume?: boolean } = {}) {
  await page.addInitScript((stallResume) => {
    const Orig = window.AudioContext;
    (window as any).__ctxs = [];
    (window as any).AudioContext = class extends Orig {
      constructor(...a: any[]) { super(...a); (window as any).__ctxs.push(this); }
    };
    if (stallResume) {
      // Headless Chromium starts contexts already running, so force the iOS
      // shape: state stuck at "suspended" and a resume() that never settles.
      const proto = Object.getPrototypeOf(Orig.prototype);
      Object.defineProperty(proto, 'state', { get: () => 'suspended', configurable: true });
      Orig.prototype.resume = () => new Promise<void>(() => {});
    }
  }, opts.stallResume ?? false);
}

const audioInfo = (page: import('@playwright/test').Page) =>
  page.evaluate(() => ({
    ctxCount: (window as any).__ctxs.length,
    states: (window as any).__ctxs.map((c: AudioContext) => c.state),
    silentAudio: document.querySelectorAll('audio').length,
    audioPaused: (document.querySelector('audio') as HTMLAudioElement | null)?.paused ?? null,
  }));

test.describe('audio unlock', () => {
  test('no tap-to-enable gate is shown', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.audio-unlock-overlay')).toHaveCount(0);
    // The app is interactive straight away
    await expect(page.locator('#play-btn')).toBeVisible();
  });

  test('no AudioContext is built before the first gesture', async ({ page }) => {
    await instrumentAudio(page);
    await gotoApp(page);
    expect(await page.evaluate(() => (window as any).__ctxs.length)).toBe(0);
  });

  test('pressing play starts audio on the first press', async ({ page }) => {
    await instrumentAudio(page);
    await gotoApp(page);

    const playBtn = page.locator('#play-btn');
    await playBtn.click();
    await expect(playBtn).toHaveText('STOP');
    await expect(page.locator('.step-btn.playing')).toHaveCount(1, { timeout: 3000 });

    const info = await audioInfo(page);
    expect(info.ctxCount).toBe(1);
    expect(info.states).toEqual(['running']);
    // Silent media element claims the iOS playback session (ringer-switch fix)
    expect(info.silentAudio).toBe(1);
    expect(info.audioPaused).toBe(false);

    await playBtn.click();
  });

  test('a tap that only previews audio still unlocks first', async ({ page }) => {
    await instrumentAudio(page);
    await gotoApp(page);

    // Any gesture, not just PLAY — the pitch keyboard and sample modal reach
    // for the context directly.
    await page.locator('.step-btn').first().dispatchEvent('pointerdown');

    const info = await audioInfo(page);
    expect(info.ctxCount).toBe(1);
    expect(info.states).toEqual(['running']);
    expect(info.silentAudio).toBe(1);
  });

  test('a stalled resume() never blocks the UI', async ({ page }) => {
    // iOS can leave resume() pending; nothing in the UI may wait on it.
    await instrumentAudio(page, { stallResume: true });
    await gotoApp(page);

    const playBtn = page.locator('#play-btn');
    await playBtn.click();
    await expect(playBtn).toHaveText('STOP', { timeout: 1000 });
  });
});
