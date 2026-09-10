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

test('keyboard focus auto-pans a proven-offscreen process node back into view', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?fixture=stress');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();

  const canvas = page.locator('.vxa-canvas');
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width * 0.15, box!.y + box!.height * 0.15);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.95, box!.y + box!.height * 0.9, { steps: 8 });
  await page.mouse.up();

  const firstNode = page.locator('.react-flow__node-process').first();
  const displacedNodeBox = await firstNode.boundingBox();
  const displacedCanvasBox = await canvas.boundingBox();
  expect(displacedNodeBox).toBeTruthy();
  expect(displacedCanvasBox).toBeTruthy();

  const isOffscreen = displacedNodeBox!.x + displacedNodeBox!.width < displacedCanvasBox!.x
    || displacedNodeBox!.x > displacedCanvasBox!.x + displacedCanvasBox!.width
    || displacedNodeBox!.y + displacedNodeBox!.height < displacedCanvasBox!.y
    || displacedNodeBox!.y > displacedCanvasBox!.y + displacedCanvasBox!.height;
  expect(isOffscreen).toBe(true);

  const beforeFocus = await readViewportMatrix(page);
  await firstNode.focus();
  await expect(firstNode).toBeFocused();
  await expectViewportChanged(page, beforeFocus);

  const nodeBox = await firstNode.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(nodeBox).toBeTruthy();
  expect(canvasBox).toBeTruthy();
  expect(nodeBox!.x + nodeBox!.width).toBeGreaterThan(canvasBox!.x);
  expect(nodeBox!.x).toBeLessThan(canvasBox!.x + canvasBox!.width);
  expect(nodeBox!.y + nodeBox!.height).toBeGreaterThan(canvasBox!.y);
  expect(nodeBox!.y).toBeLessThan(canvasBox!.y + canvasBox!.height);
});
