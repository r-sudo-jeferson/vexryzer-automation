import { expect, test, type Page } from '@playwright/test';

interface ViewportMatrix {
  x: number;
  y: number;
  zoom: number;
}

async function readViewportMatrix(page: Page): Promise<ViewportMatrix> {
  return page.locator('.react-flow__viewport').evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: matrix.m41, y: matrix.m42, zoom: matrix.a };
  });
}

async function expectViewportChanged(page: Page, before: ViewportMatrix): Promise<void> {
  await expect.poll(async () => {
    const after = await readViewportMatrix(page);
    return Math.abs(after.x - before.x) + Math.abs(after.y - before.y) + Math.abs(after.zoom - before.zoom);
  }).toBeGreaterThan(0.5);
}

async function driveZoomBand(page: Page, target: 'far' | 'near', deltaY: number): Promise<void> {
  const canvas = page.locator('.vxa-canvas');
  await canvas.hover();
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (await canvas.getAttribute('data-zoom-band') === target) return;
    await page.mouse.wheel(0, deltaY);
  }
  await expect(canvas).toHaveAttribute('data-zoom-band', target);
}

test('mouse pan, wheel zoom and semantic zoom remain optional exploration controls', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?perf=1');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();

  const canvas = page.locator('.vxa-canvas');
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const beforePan = await readViewportMatrix(page);
  await page.mouse.move(box!.x + box!.width * 0.55, box!.y + box!.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.68, box!.y + box!.height * 0.62, { steps: 5 });
  await page.mouse.up();
  await expectViewportChanged(page, beforePan);
  await expect(page.locator('.vxa-step[data-active="true"]')).toHaveCount(0);

  await driveZoomBand(page, 'far', 180);
  await driveZoomBand(page, 'near', -180);
});

test('touch pan and pinch move the viewport without selecting process nodes', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('mobile')) test.skip();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?perf=1');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();

  const canvas = page.locator('.vxa-canvas');
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const session = await page.context().newCDPSession(page);
  const centerX = Math.round(box!.x + box!.width * 0.5);
  const centerY = Math.round(box!.y + box!.height * 0.5);

  const beforePan = await readViewportMatrix(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: centerX, y: centerY, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: centerX + 70, y: centerY + 25, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expectViewportChanged(page, beforePan);
  await expect(page.locator('.vxa-step[data-active="true"]')).toHaveCount(0);

  const beforePinch = await readViewportMatrix(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: centerX - 30, y: centerY, id: 1 },
      { x: centerX + 30, y: centerY, id: 2 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: centerX - 85, y: centerY, id: 1 },
      { x: centerX + 85, y: centerY, id: 2 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expectViewportChanged(page, beforePinch);
  await expect(page.locator('.vxa-step[data-active="true"]')).toHaveCount(0);
});

test('user drag interrupts camera travel instead of being overwritten by the prior camera command', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();
  await page.goto('/?fixture=stress&perf=1');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await page.waitForTimeout(520);

  const lastStep = page.getByRole('button', { name: /20 Saída consolidada/i });
  await lastStep.scrollIntoViewIfNeeded();
  await lastStep.click();
  await expect(page.locator('.vxa-canvas')).toHaveAttribute('data-mode', 'focus');

  const canvas = page.locator('.vxa-canvas');
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width * 0.45, box!.y + box!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.62, box!.y + box!.height * 0.57, { steps: 4 });
  await page.mouse.up();

  const afterDrag = await readViewportMatrix(page);
  await page.waitForTimeout(450);
  const afterFormerTravelWindow = await readViewportMatrix(page);
  expect(Math.abs(afterFormerTravelWindow.x - afterDrag.x)).toBeLessThan(0.6);
  expect(Math.abs(afterFormerTravelWindow.y - afterDrag.y)).toBeLessThan(0.6);
  expect(Math.abs(afterFormerTravelWindow.zoom - afterDrag.zoom)).toBeLessThan(0.005);
  await expect.poll(() => page.evaluate(() => window.__VXA_PERF__?.cameraInterruptions ?? 0)).toBeGreaterThan(0);
});

test('resize during camera travel reissues the same intent, while repeated identical focus does not churn camera commands', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();
  await page.goto('/?fixture=stress&perf=1');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect.poll(() => page.evaluate(() => window.__VXA_PERF__?.cameraResizeRefits ?? 0)).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const target = page.getByRole('button', { name: /02 Etapa manual 2/i });
  await target.click();
  await expect(target).toHaveAttribute('data-active', 'true');
  const beforeRepeated = await page.evaluate(() => window.__VXA_PERF__?.cameraCommands ?? 0);
  for (let repeat = 0; repeat < 4; repeat += 1) await target.click();
  await page.waitForTimeout(60);
  const afterRepeated = await page.evaluate(() => window.__VXA_PERF__?.cameraCommands ?? 0);
  expect(afterRepeated).toBe(beforeRepeated);
});
