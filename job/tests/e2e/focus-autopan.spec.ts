import { expect, test, type Page } from '@playwright/test';

interface ViewportMatrix {
  x: number;
  y: number;
  zoom: number;
}

interface Point {
  x: number;
  y: number;
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

async function mousePan(page: Page, delta: Point): Promise<void> {
  const pane = page.locator('.react-flow__pane');
  await pane.scrollIntoViewIfNeeded();
  const start = await pane.evaluate((element, requestedDelta) => {
    const rect = element.getBoundingClientRect();
    const fractions = [0.12, 0.25, 0.4, 0.6, 0.75, 0.88];
    for (const yFraction of fractions) {
      for (const xFraction of fractions) {
        const x = rect.left + rect.width * xFraction;
        const y = rect.top + rect.height * yFraction;
        const endX = x + requestedDelta.x;
        const endY = y + requestedDelta.y;
        if (x <= 36 || y <= 36 || x >= innerWidth - 36 || y >= innerHeight - 36) continue;
        if (endX <= 36 || endY <= 36 || endX >= innerWidth - 36 || endY >= innerHeight - 36) continue;
        if (document.elementFromPoint(x, y) === element) return { x, y };
      }
    }
    return null;
  }, delta);
  expect(start, 'expected a visible empty pane target for real pan input').toBeTruthy();
  await page.mouse.move(start!.x, start!.y);
  await page.mouse.down();
  await page.mouse.move(start!.x + delta.x, start!.y + delta.y, { steps: 6 });
  await page.mouse.up();
}

function outside(nodeBox: { x: number; y: number; width: number; height: number }, canvasBox: { x: number; y: number; width: number; height: number }): boolean {
  return nodeBox.x + nodeBox.width < canvasBox.x
    || nodeBox.x > canvasBox.x + canvasBox.width
    || nodeBox.y + nodeBox.height < canvasBox.y
    || nodeBox.y > canvasBox.y + canvasBox.height;
}

test('keyboard focus auto-pans a proven-offscreen process node back into view', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?fixture=stress');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();

  const canvas = page.locator('.vxa-canvas');
  const firstNode = page.locator('.react-flow__node-process').first();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const nodeBox = await firstNode.boundingBox();
    const canvasBox = await canvas.boundingBox();
    expect(nodeBox).toBeTruthy();
    expect(canvasBox).toBeTruthy();
    if (outside(nodeBox!, canvasBox!)) break;
    const beforePan = await readViewportMatrix(page);
    await mousePan(page, { x: 180, y: 110 });
    await expectViewportChanged(page, beforePan);
  }

  const displacedNodeBox = await firstNode.boundingBox();
  const displacedCanvasBox = await canvas.boundingBox();
  expect(displacedNodeBox).toBeTruthy();
  expect(displacedCanvasBox).toBeTruthy();
  expect(outside(displacedNodeBox!, displacedCanvasBox!)).toBe(true);

  const beforeFocus = await readViewportMatrix(page);
  await firstNode.focus();
  await expect(firstNode).toBeFocused();
  await expectViewportChanged(page, beforeFocus);

  const nodeBox = await firstNode.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(nodeBox).toBeTruthy();
  expect(canvasBox).toBeTruthy();
  expect(outside(nodeBox!, canvasBox!)).toBe(false);
});
