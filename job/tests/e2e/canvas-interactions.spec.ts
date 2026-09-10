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

async function findPanePoint(page: Page, delta: Point = { x: 0, y: 0 }): Promise<Point> {
  const pane = page.locator('.react-flow__pane');
  await pane.scrollIntoViewIfNeeded();
  const point = await pane.evaluate((element, requestedDelta) => {
    const rect = element.getBoundingClientRect();
    const fractions = [0.12, 0.25, 0.4, 0.6, 0.75, 0.88];
    const guard = 36;
    for (const yFraction of fractions) {
      for (const xFraction of fractions) {
        const x = rect.left + rect.width * xFraction;
        const y = rect.top + rect.height * yFraction;
        const endX = x + requestedDelta.x;
        const endY = y + requestedDelta.y;
        if (x <= guard || y <= guard || x >= innerWidth - guard || y >= innerHeight - guard) continue;
        if (endX <= guard || endY <= guard || endX >= innerWidth - guard || endY >= innerHeight - guard) continue;
        const probes = [[0, 0], [28, 0], [-28, 0], [0, 28], [0, -28]] as const;
        if (probes.every(([dx, dy]) => document.elementFromPoint(x + dx, y + dy) === element)) return { x, y };
      }
    }
    return null;
  }, delta);
  expect(point, 'expected a visible empty React Flow pane hit target').toBeTruthy();
  return point!;
}

async function mousePan(page: Page, delta: Point): Promise<void> {
  const start = await findPanePoint(page, delta);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 6 });
  await page.mouse.up();
}

async function touchDrag(page: Page, start: Point, end: Point): Promise<void> {
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(start.x), y: Math.round(start.y), id: 1 }] });
  for (let step = 1; step <= 6; step += 1) {
    const progress = step / 6;
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{
        x: Math.round(start.x + (end.x - start.x) * progress),
        y: Math.round(start.y + (end.y - start.y) * progress),
        id: 1,
      }],
    });
    await page.waitForTimeout(16);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}

async function driveZoomBand(page: Page, target: 'far' | 'near', deltaY: number): Promise<void> {
  const canvas = page.locator('.vxa-canvas');
  let previous = await readViewportMatrix(page);
  let observedZoomChange = false;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    if (await canvas.getAttribute('data-zoom-band') === target) {
      expect(observedZoomChange).toBe(true);
      return;
    }
    const point = await findPanePoint(page);
    await page.mouse.move(point.x, point.y);
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(32);
    const current = await readViewportMatrix(page);
    if (Math.abs(current.zoom - previous.zoom) > 0.001) observedZoomChange = true;
    previous = current;
  }
  expect(observedZoomChange).toBe(true);
  await expect(canvas).toHaveAttribute('data-zoom-band', target);
}

function outside(nodeBox: { x: number; y: number; width: number; height: number }, canvasBox: { x: number; y: number; width: number; height: number }): boolean {
  return nodeBox.x + nodeBox.width < canvasBox.x
    || nodeBox.x > canvasBox.x + canvasBox.width
    || nodeBox.y + nodeBox.height < canvasBox.y
    || nodeBox.y > canvasBox.y + canvasBox.height;
}

test('mouse pan, wheel zoom and semantic zoom remain optional exploration controls', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?perf=1');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();

  const beforePan = await readViewportMatrix(page);
  await mousePan(page, { x: 140, y: 70 });
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

  const start = await findPanePoint(page, { x: 55, y: 24 });
  const beforePan = await readViewportMatrix(page);
  await touchDrag(page, start, { x: start.x + 55, y: start.y + 24 });
  await expectViewportChanged(page, beforePan);
  await expect(page.locator('.vxa-step[data-active="true"]')).toHaveCount(0);

  const pinchCenter = await findPanePoint(page);
  const beforePinch = await readViewportMatrix(page);
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: Math.round(pinchCenter.x - 24), y: Math.round(pinchCenter.y), id: 1 },
      { x: Math.round(pinchCenter.x + 24), y: Math.round(pinchCenter.y), id: 2 },
    ],
  });
  for (let step = 1; step <= 6; step += 1) {
    const spread = 24 + (64 * step) / 6;
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: Math.round(pinchCenter.x - spread), y: Math.round(pinchCenter.y), id: 1 },
        { x: Math.round(pinchCenter.x + spread), y: Math.round(pinchCenter.y), id: 2 },
      ],
    });
    await page.waitForTimeout(16);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
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

  await mousePan(page, { x: 150, y: 65 });
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

test('trackpad-pinch equivalent ctrl-wheel zooms the canvas without becoming a core navigation requirement', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();

  const before = await readViewportMatrix(page);
  await page.locator('.react-flow__pane').evaluate((pane) => {
    const rect = pane.getBoundingClientRect();
    pane.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -120,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }));
  });
  await expect.poll(async () => (await readViewportMatrix(page)).zoom).toBeGreaterThan(before.zoom);
});

test('keyboard focus auto-pans an offscreen process node back into view', async ({ page }, testInfo) => {
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
  await page.getByRole('button', { name: /Voltar à origem/i }).focus();
  await page.keyboard.press('Tab');
  await expect(firstNode).toBeFocused();
  await expect.poll(() => firstNode.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  await expectViewportChanged(page, beforeFocus);
  const nodeBox = await firstNode.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(nodeBox).toBeTruthy();
  expect(canvasBox).toBeTruthy();
  expect(outside(nodeBox!, canvasBox!)).toBe(false);
});

test('stress layout has no visually overlapping process-node rectangles after camera settle', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?fixture=stress');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();

  const boxes = await page.locator('.react-flow__node-process').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }));
  expect(boxes.length).toBe(20);

  const overlaps: Array<[number, number]> = [];
  for (let a = 0; a < boxes.length; a += 1) {
    for (let b = a + 1; b < boxes.length; b += 1) {
      const first = boxes[a]!;
      const second = boxes[b]!;
      const overlapX = Math.min(first.right, second.right) - Math.max(first.left, second.left);
      const overlapY = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
      if (overlapX > 1 && overlapY > 1) overlaps.push([a, b]);
    }
  }
  expect(overlaps).toEqual([]);
});

test('vertical touch scrolling in directed mobile navigation does not drag the canvas viewport', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('mobile')) test.skip();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?fixture=stress');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();

  const director = page.locator('.vxa-director__steps');
  await director.scrollIntoViewIfNeeded();
  const overflow = await director.evaluate((element) => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);
  const box = await director.boundingBox();
  expect(box).toBeTruthy();
  const beforeViewport = await readViewportMatrix(page);
  const beforeScroll = await director.evaluate((element) => element.scrollTop);
  const start = { x: box!.x + box!.width * 0.5, y: box!.y + box!.height * 0.8 };
  const end = { x: start.x, y: box!.y + box!.height * 0.22 };
  await touchDrag(page, start, end);

  await expect.poll(() => director.evaluate((element) => element.scrollTop)).toBeGreaterThan(beforeScroll);
  const afterViewport = await readViewportMatrix(page);
  expect(Math.abs(afterViewport.x - beforeViewport.x)).toBeLessThan(0.5);
  expect(Math.abs(afterViewport.y - beforeViewport.y)).toBeLessThan(0.5);
  expect(Math.abs(afterViewport.zoom - beforeViewport.zoom)).toBeLessThan(0.005);
});
