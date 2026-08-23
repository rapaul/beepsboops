import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

test.describe('audio unlock overlay', () => {
  test('appears on load with a tap-to-enable prompt', async ({ page }) => {
    await page.goto('/');
    const overlay = page.locator('.audio-unlock-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('TAP TO ENABLE SOUND');
  });

  test('covers the app so no interaction happens before the gesture', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.audio-unlock-overlay');
    const box = await page.locator('.audio-unlock-overlay').boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(box!.height).toBeGreaterThanOrEqual(viewport.height - 1);
  });

  test('dismisses on pointerdown and starts the audio context', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.audio-unlock-overlay')).toHaveCount(0);

    // Playback works immediately afterwards
    const playBtn = page.locator('#play-btn');
    await playBtn.click();
    await expect(playBtn).toHaveText('STOP');
    await expect(page.locator('.step-btn.playing')).toHaveCount(1, { timeout: 3000 });
    await playBtn.click();
  });

  test('unlock puts the AudioContext into running state and claims a media session', async ({ page }) => {
    await page.addInitScript(() => {
      const Orig = window.AudioContext;
      (window as any).__ctxs = [];
      (window as any).AudioContext = class extends Orig {
        constructor(...a: any[]) { super(...a); (window as any).__ctxs.push(this); }
      };
    });
    await page.goto('/');
    await page.waitForSelector('.audio-unlock-overlay');

    // No context created before the gesture
    expect(await page.evaluate(() => (window as any).__ctxs.length)).toBe(0);

    await page.locator('.audio-unlock-overlay').dispatchEvent('pointerdown');
    await page.locator('.audio-unlock-overlay').waitFor({ state: 'detached' });

    const info = await page.evaluate(() => ({
      ctxCount: (window as any).__ctxs.length,
      states: (window as any).__ctxs.map((c: AudioContext) => c.state),
      silentAudio: document.querySelectorAll('audio').length,
      audioPaused: (document.querySelector('audio') as HTMLAudioElement | null)?.paused ?? null,
    }));

    expect(info.ctxCount).toBe(1);
    expect(info.states).toEqual(['running']);
    expect(info.silentAudio).toBe(1);
    expect(info.audioPaused).toBe(false);
  });

  test('a single tap dismisses it even if resume() never settles', async ({ page }) => {
    // iOS can stall resume(); the overlay must not wait on it, or the first tap
    // looks like it did nothing and users tap twice.
    await page.addInitScript(() => {
      // Headless Chromium starts contexts already running, so force the iOS
      // shape: state stuck at "suspended" and a resume() that never settles.
      const proto = Object.getPrototypeOf(window.AudioContext.prototype);
      Object.defineProperty(proto, 'state', { get: () => 'suspended', configurable: true });
      window.AudioContext.prototype.resume = () => new Promise<void>(() => {});
    });
    await page.goto('/');
    await page.waitForSelector('.audio-unlock-overlay');

    await page.locator('.audio-unlock-overlay').dispatchEvent('pointerdown');
    await expect(page.locator('.audio-unlock-overlay')).toHaveCount(0, { timeout: 1000 });
  });
});
