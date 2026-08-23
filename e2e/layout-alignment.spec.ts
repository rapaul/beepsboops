import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

test('transport and actions bar alignment', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await gotoApp(page);
  await page.waitForSelector('.transport-row');

  await page.screenshot({ path: 'test-results/layout-mobile.png', fullPage: false });

  // Get bounding boxes
  const bpmControls = await page.locator('.bpm-controls').boundingBox();
  const playBtn = await page.locator('#play-btn').boundingBox();
  const patchBtn = await page.locator('#patch-btn').boundingBox();
  const clearBtn = await page.locator('.action-btn').first().boundingBox();
  const copyBtn = await page.locator('.action-btn').nth(1).boundingBox();
  const watLink = await page.locator('.wat-link').boundingBox();

  console.log('Transport row:');
  console.log('  BPM controls:', JSON.stringify(bpmControls));
  console.log('  Play btn:    ', JSON.stringify(playBtn));
  console.log('  Patch btn:   ', JSON.stringify(patchBtn));
  console.log('Actions bar:');
  console.log('  Clear btn:   ', JSON.stringify(clearBtn));
  console.log('  Copy btn:    ', JSON.stringify(copyBtn));
  console.log('  Wat link:    ', JSON.stringify(watLink));

  // Transport row: all items same width
  expect(Math.round(bpmControls!.width)).toBeCloseTo(Math.round(playBtn!.width), -1);
  expect(Math.round(playBtn!.width)).toBeCloseTo(Math.round(patchBtn!.width), -1);

  // Actions bar: all items same width
  expect(Math.round(clearBtn!.width)).toBeCloseTo(Math.round(copyBtn!.width), -1);
  expect(Math.round(copyBtn!.width)).toBeCloseTo(Math.round(watLink!.width), -1);

  // Both rows start at the same x
  expect(bpmControls!.x).toBeCloseTo(clearBtn!.x, -1);
  // Both rows end at the same x
  expect(Math.round(patchBtn!.x + patchBtn!.width)).toBeCloseTo(
    Math.round(watLink!.x + watLink!.width), -1
  );
});
