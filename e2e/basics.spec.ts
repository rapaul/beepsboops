import { test, expect } from '@playwright/test';

test.describe('page load', () => {
  test('app renders after samples load', async ({ page }) => {
    await page.goto('/');
    // The loading div should be replaced by the grid once init() completes
    await expect(page.locator('#grid')).toBeVisible();
    await expect(page.locator('.loading')).toHaveCount(0);
  });

  test('title is beepsboops', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('beepsboops');
  });
});

test.describe('samples load', () => {
  test('all sample requests succeed', async ({ page }) => {
    const failedSamples: string[] = [];

    page.on('response', (response) => {
      if (response.url().includes('/samples/') && !response.ok()) {
        failedSamples.push(response.url());
      }
    });

    await page.goto('/');
    await expect(page.locator('#grid')).toBeVisible();
    expect(failedSamples).toEqual([]);
  });
});

test.describe('sequencer grid', () => {
  test('renders 16 step buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#grid')).toBeVisible();
    const steps = page.locator('.step-btn');
    await expect(steps).toHaveCount(16);
  });

  test('renders 8 track buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tracks')).toBeVisible();
    const tracks = page.locator('.track-btn');
    await expect(tracks).toHaveCount(8);
  });

  test('first track is selected by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tracks')).toBeVisible();
    const firstTrack = page.locator('.track-btn').first();
    await expect(firstTrack).toHaveClass(/track-active/);
  });
});

test.describe('interactivity', () => {
  test('clicking a step toggles it on', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#grid')).toBeVisible();

    const step = page.locator('.step-btn').nth(0);
    await expect(step).not.toHaveClass(/active/);

    await step.dispatchEvent('pointerdown');
    await expect(step).toHaveClass(/active/);
  });

  test('clicking a step again toggles it off', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#grid')).toBeVisible();

    const step = page.locator('.step-btn').nth(0);
    await step.dispatchEvent('pointerdown');
    await expect(step).toHaveClass(/active/);

    await step.dispatchEvent('pointerdown');
    await expect(step).not.toHaveClass(/active/);
  });

  test('switching tracks updates the grid', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#grid')).toBeVisible();

    // Activate step 0 on the first track
    const step0 = page.locator('.step-btn').nth(0);
    await step0.dispatchEvent('pointerdown');
    await expect(step0).toHaveClass(/active/);

    // Switch to second track — step 0 should no longer be active
    await page.locator('.track-btn').nth(1).dispatchEvent('pointerdown');
    await expect(step0).not.toHaveClass(/active/);

    // Switch back — step 0 should be active again
    await page.locator('.track-btn').nth(0).dispatchEvent('pointerdown');
    await expect(step0).toHaveClass(/active/);
  });

  test('BPM buttons adjust the display', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#transport')).toBeVisible();

    const bpmDisplay = page.locator('#bpm-display');
    const initialBpm = await bpmDisplay.textContent();

    await page.locator('#bpm-up').dispatchEvent('pointerdown');
    await page.locator('#bpm-up').dispatchEvent('pointerup');
    const newBpm = await bpmDisplay.textContent();

    expect(Number(newBpm)).toBe(Number(initialBpm) + 1);
  });
});

test.describe('playback', () => {
  test('play button toggles text to STOP', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#transport')).toBeVisible();

    const playBtn = page.locator('#play-btn');
    await expect(playBtn).toHaveText('PLAY');

    await playBtn.click();
    await expect(playBtn).toHaveText('STOP');
    await expect(playBtn).toHaveClass(/playing/);
  });

  test('stop returns button text to PLAY', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#transport')).toBeVisible();

    const playBtn = page.locator('#play-btn');
    await playBtn.click();
    await expect(playBtn).toHaveText('STOP');

    await playBtn.click();
    await expect(playBtn).toHaveText('PLAY');
    await expect(playBtn).not.toHaveClass(/playing/);
  });

  test('playhead advances steps while playing', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#grid')).toBeVisible();

    const playBtn = page.locator('#play-btn');
    await playBtn.click();
    await expect(playBtn).toHaveText('STOP');

    // Wait for the playhead to mark at least one step
    await expect(page.locator('.step-btn.playing')).toHaveCount(1, {
      timeout: 3000,
    });

    // Stop playback
    await playBtn.click();
  });
});
