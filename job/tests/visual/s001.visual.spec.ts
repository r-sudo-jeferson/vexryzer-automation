import { expect, test, type Page, type TestInfo } from '@playwright/test';

const requiredViewports = [
  [1440, 1080],
  [1366, 768],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
] as const;

interface RectEvidence {
  label: string;
  contained: boolean;
  intersects: boolean;
  inset: number;
}

interface VisualFrame {
  canvasIntersectsViewport: boolean;
  processNodes: RectEvidence[];
  originNodes: RectEvidence[];
  selectedNodes: RectEvidence[];
  attributions: RectEvidence[];
}

async function waitForViewportStable(
  page: Page,
  { stableForMs = 240, timeoutMs = 4_000, tolerance = 0.01 } = {},
): Promise<void> {
  await page.locator('.react-flow__viewport').evaluate((viewport, options) => new Promise<void>((resolve, reject) => {
    let stableSince: number | null = null;
    let previous: readonly number[] | null = null;
    let lastMatrix: readonly number[] = [];
    let finished = false;

    const hardTimeout = window.setTimeout(() => {
      finished = true;
      reject(new Error(
        `React Flow viewport did not remain stable for ${options.stableForMs}ms `
        + `within ${options.timeoutMs}ms (last DOMMatrix: ${lastMatrix.join(', ')})`,
      ));
    }, options.timeoutMs);

    const readMatrix = (): readonly number[] => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(viewport).transform);
      return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
    };

    const measure = (now: number) => {
      if (finished) return;
      const current = readMatrix();
      lastMatrix = current;
      const delta = previous === null
        ? Number.POSITIVE_INFINITY
        : Math.max(...current.map((value, index) => Math.abs(value - previous![index]!)));

      stableSince = delta <= options.tolerance ? (stableSince ?? now) : null;
      previous = current;

      if (stableSince !== null && now - stableSince >= options.stableForMs) {
        finished = true;
        clearTimeout(hardTimeout);
        resolve();
        return;
      }
      requestAnimationFrame(measure);
    };

    requestAnimationFrame(measure);
  }), { stableForMs, timeoutMs, tolerance });
}

async function readVisualFrame(page: Page): Promise<VisualFrame> {
  return page.locator('.vxa-canvas').evaluate((canvas) => {
    const canvasRect = canvas.getBoundingClientRect();
    const measure = (selector: string) => [...canvas.querySelectorAll<HTMLElement>(selector)].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        label: element.getAttribute('aria-label') ?? element.textContent?.trim().replace(/\s+/g, ' ') ?? selector,
        contained: rect.left >= canvasRect.left - 0.5
          && rect.top >= canvasRect.top - 0.5
          && rect.right <= canvasRect.right + 0.5
          && rect.bottom <= canvasRect.bottom + 0.5,
        intersects: Math.min(rect.right, canvasRect.right) - Math.max(rect.left, canvasRect.left) > 0
          && Math.min(rect.bottom, canvasRect.bottom) - Math.max(rect.top, canvasRect.top) > 0,
        inset: Math.min(
          rect.left - canvasRect.left,
          rect.top - canvasRect.top,
          canvasRect.right - rect.right,
          canvasRect.bottom - rect.bottom,
        ),
      };
    });

    return {
      canvasIntersectsViewport: canvasRect.left < innerWidth
        && canvasRect.top < innerHeight
        && canvasRect.right > 0
        && canvasRect.bottom > 0,
      processNodes: measure('.react-flow__node-process'),
      originNodes: measure('.react-flow__node-origin'),
      selectedNodes: measure('.react-flow__node-process:has(.vxa-node[data-selected="true"])'),
      attributions: measure('.react-flow__attribution'),
    };
  });
}

function expectContained(elements: RectEvidence[], expectedCount: number, context: string): void {
  expect.soft(elements, `${context}: expected ${expectedCount} rendered node(s)`).toHaveLength(expectedCount);
  expect.soft(
    elements.filter((element) => !element.contained).map((element) => element.label),
    `${context}: every required node must be entirely contained by the canvas`,
  ).toEqual([]);
}

function expectAttributionInset(frame: VisualFrame, context: string): void {
  expect.soft(frame.attributions, `${context}: React Flow attribution remains rendered`).toHaveLength(1);
  expect.soft(
    frame.attributions.filter((attribution) => !attribution.contained || attribution.inset < 4)
      .map((attribution) => ({ label: attribution.label, inset: attribution.inset })),
    `${context}: React Flow attribution must be entirely contained with a 4px visual inset`,
  ).toEqual([]);
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<VisualFrame> {
  await waitForViewportStable(page);
  const frame = await readVisualFrame(page);
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  expectAttributionInset(frame, name);
  return frame;
}

async function captureWithoutCanvas(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

for (const [width, height] of requiredViewports) {
  test(`process evidence ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('button', { name: /Explorar um processo/i }).click();
    await expect(page.locator('.vxa-stage')).toBeVisible();
    const frame = await capture(page, testInfo, `process-${width}x${height}`);
    expect.soft(
      frame.canvasIntersectsViewport,
      `process ${width}x${height}: canvas must intersect the initial viewport after entering the process`,
    ).toBe(true);
    expectContained(frame.processNodes, 4, `process ${width}x${height}`);
  });
}

test('origin evidence desktop and mobile', async ({ page }, testInfo) => {
  for (const [width, height] of [[1440, 1080], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Explorar um processo/i })).toBeVisible();
    const frame = await capture(page, testInfo, `origin-${width}x${height}`);
    expectContained(frame.originNodes, 1, `origin ${width}x${height}`);
  }
});

test('focused node evidence desktop and mobile', async ({ page }, testInfo) => {
  for (const [width, height] of [[1440, 1080], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('button', { name: /Explorar um processo/i }).click();
    await page.getByRole('button', { name: /02 Conferência manual/i }).click();
    await expect(page.getByRole('button', { name: /02 Conferência manual/i })).toHaveAttribute('data-active', 'true');
    const frame = await capture(page, testInfo, `focus-${width}x${height}`);
    expectContained(frame.selectedNodes, 1, `focus ${width}x${height}`);
  }
});

test('keyboard focus evidence', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /Explorar um processo/i })).toBeFocused();
  await capture(page, testInfo, 'keyboard-focus-origin');
});

test('reduced-motion equivalent evidence desktop and mobile', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [[1440, 1080], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('button', { name: /Explorar um processo/i }).click();
    await expect(page.locator('.vxa-shell')).toHaveAttribute('data-motion', 'reduced');
    const frame = await capture(page, testInfo, `reduced-process-${width}x${height}`);
    expectContained(frame.processNodes, 4, `reduced process ${width}x${height}`);
  }
});

test('adversarial long-content and duplicate-label evidence', async ({ page }, testInfo) => {
  const fixtures = [
    { name: 'longContent', nodeCount: 2 },
    { name: 'duplicateLabels', nodeCount: 3 },
  ] as const;
  for (const fixture of fixtures) {
    for (const [width, height] of [[1440, 1080], [390, 844]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(`/?fixture=${fixture.name}`);
      await page.getByRole('button', { name: /Explorar um processo/i }).click();
      const frame = await capture(page, testInfo, `${fixture.name}-${width}x${height}`);
      expectContained(frame.processNodes, fixture.nodeCount, `${fixture.name} ${width}x${height}`);
    }
  }
});

test('provenance, uncertainty, single-node and empty-state evidence', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1080 });

  await page.goto('/?fixture=provenance');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await page.getByRole('button', { name: /Sistema a confirmar/i }).click();
  await expect(page.getByText('Hipótese', { exact: true })).toBeVisible();
  await capture(page, testInfo, 'provenance-uncertainty-focus');

  await page.goto('/?fixture=single');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await expect(page.locator('.vxa-step')).toHaveCount(1);
  await capture(page, testInfo, 'single-node-process');
  await expect.soft(page.locator('.vxa-director__heading strong')).toHaveText('1 etapa mapeada');
  await expect.soft(page.locator('.vxa-canvas__status span').last()).toHaveText('1 etapa');

  await page.goto('/?fixture=origin');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await expect(page.getByText(/Este cenário não contém etapas/i)).toBeVisible();
  await capture(page, testInfo, 'empty-process');

  await page.goto('/?fixture=error');
  await expect(page.getByRole('heading', { name: /A experiência visual encontrou um problema/i })).toBeVisible();
  await captureWithoutCanvas(page, testInfo, 'error-recovery');
});

test('20-node stress evidence desktop and mobile', async ({ page }, testInfo) => {
  for (const [width, height] of [[1366, 768], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/?fixture=stress');
    await page.getByRole('button', { name: /Explorar um processo/i }).click();
    await expect(page.locator('.vxa-step')).toHaveCount(20);
    const frame = await capture(page, testInfo, `stress-${width}x${height}`);
    expect.soft(frame.processNodes, `stress ${width}x${height}: all 20 canvas nodes remain rendered`).toHaveLength(20);
    expect.soft(
      frame.processNodes.filter((node) => node.intersects).length,
      `stress ${width}x${height}: at least six process nodes must intersect the canvas after camera stability`,
    ).toBeGreaterThanOrEqual(6);
    await expect.soft(page.locator('.vxa-director__heading strong')).toHaveText('20 etapas mapeadas');
    await expect.soft(page.locator('.vxa-canvas__status span').last()).toHaveText('20 etapas');
  }
});
