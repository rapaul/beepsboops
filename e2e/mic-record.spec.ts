import { test, expect, type Page } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * Stand in for the iOS audio session API, which no desktop browser implements,
 * and make getUserMedia enforce its real constraint: capture is refused while
 * the session is playback-only.
 */
async function fakeIosAudioSession(page: Page) {
  await page.addInitScript(() => {
    const state = { type: 'auto', denials: 0 };
    (window as any).__session = state;
    Object.defineProperty(navigator, 'audioSession', {
      configurable: true,
      value: { get type() { return state.type; }, set type(t: string) { state.type = t; } },
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          if (state.type !== 'play-and-record') {
            state.denials++;
            const e = new Error('playback session active');
            e.name = 'NotAllowedError';
            throw e;
          }
          const ctx = new AudioContext();
          const dest = (ctx as any).createMediaStreamDestination();
          return dest.stream as MediaStream;
        },
      },
    });
  });
}

/** Long-press a custom slot to open its sample modal. */
async function openSampleModal(page: Page) {
  const slot = page.locator('.track-btn.custom').first();
  await slot.dispatchEvent('pointerdown');
  await expect(page.locator('.modal-tui')).toBeVisible();
}

test.describe('mic recording', () => {
  test('recording claims the play-and-record session and is not denied', async ({ page }) => {
    await fakeIosAudioSession(page);
    await gotoApp(page);
    // A gesture first, so the unlock has set the playback session
    await page.locator('#play-btn').click();
    await page.locator('#play-btn').click();
    expect(await page.evaluate(() => (window as any).__session.type)).toBe('playback');

    await openSampleModal(page);
    await page.locator('.modal-tui-option', { hasText: 'RECORD' }).first().dispatchEvent('pointerdown');

    await expect(page.locator('.modal-recording')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.modal-tui')).not.toContainText('MIC ACCESS DENIED');

    const session = await page.evaluate(() => (window as any).__session);
    expect(session.type).toBe('play-and-record');
    expect(session.denials).toBe(0);
  });

  test('the playback session is restored after recording stops', async ({ page }) => {
    await fakeIosAudioSession(page);
    await gotoApp(page);
    await openSampleModal(page);
    await page.locator('.modal-tui-option', { hasText: 'RECORD' }).first().dispatchEvent('pointerdown');
    await expect(page.locator('.modal-recording')).toBeVisible({ timeout: 3000 });

    // Closing the modal mid-recording must hand the session back. Tapping the
    // backdrop (not the box) is what closes it.
    await page.locator('.modal-overlay').dispatchEvent('pointerdown');
    await page.locator('.modal-overlay').waitFor({ state: 'detached' });
    await expect
      .poll(() => page.evaluate(() => (window as any).__session.type))
      .toBe('playback');
  });

  test('a genuinely refused mic still reports denied', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            const e = new Error('denied'); e.name = 'NotAllowedError'; throw e;
          },
        },
      });
    });
    await gotoApp(page);
    await openSampleModal(page);
    await page.locator('.modal-tui-option', { hasText: 'RECORD' }).first().dispatchEvent('pointerdown');
    await expect(page.locator('.modal-tui')).toContainText('MIC ACCESS DENIED', { timeout: 3000 });
  });

  test('a missing mic is not reported as denied', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            const e = new Error('no device'); e.name = 'NotFoundError'; throw e;
          },
        },
      });
    });
    await gotoApp(page);
    await openSampleModal(page);
    await page.locator('.modal-tui-option', { hasText: 'RECORD' }).first().dispatchEvent('pointerdown');
    await expect(page.locator('.modal-tui')).toContainText('NO MICROPHONE FOUND', { timeout: 3000 });
    await expect(page.locator('.modal-tui')).not.toContainText('MIC ACCESS DENIED');
  });
});
