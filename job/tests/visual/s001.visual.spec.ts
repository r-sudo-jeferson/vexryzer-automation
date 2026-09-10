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

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
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
    await capture(page, testInfo, `process-${width}x${height}`);
  });
}

test('origin evidence desktop and mobile', async ({ page }, testInfo) => {
  for (const [width, height] of [[1440, 1080], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Explorar um processo/i })).toBeVisible();
    await capture(page, testInfo, `origin-${width}x${height}`);
  }
});

test('focused node evidence desktop and mobile', async ({ page }, testInfo) => {
  for (const [width, height] of [[1440, 1080], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('button', { name: /Explorar um processo/i }).click();
    await page.getByRole('button', { name: /02 Conferência manual/i }).click();
    await expect(page.getByRole('button', { name: /02 Conferência manual/i })).toHaveAttribute('data-active', 'true');
    await capture(page, testInfo, `focus-${width}x${height}`);
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
    await capture(page, testInfo, `reduced-process-${width}x${height}`);
  }
});

test('adversarial long-content and duplicate-label evidence', async ({ page }, testInfo) => {
  for (const fixture of ['longContent', 'duplicateLabels'] as const) {
    for (const [width, height] of [[1440, 1080], [390, 844]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(`/?fixture=${fixture}`);
      await page.getByRole('button', { name: /Explorar um processo/i }).click();
      await capture(page, testInfo, `${fixture}-${width}x${height}`);
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

  await page.goto('/?fixture=origin');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await expect(page.getByText(/Este cenário não contém etapas/i)).toBeVisible();
  await capture(page, testInfo, 'empty-process');

  await page.goto('/?fixture=error');
  await expect(page.getByRole('heading', { name: /A experiência visual encontrou um problema/i })).toBeVisible();
  await capture(page, testInfo, 'error-recovery');
});

test('20-node stress evidence desktop and mobile', async ({ page }, testInfo) => {
  for (const [width, height] of [[1366, 768], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/?fixture=stress');
    await page.getByRole('button', { name: /Explorar um processo/i }).click();
    await expect(page.locator('.vxa-step')).toHaveCount(20);
    await capture(page, testInfo, `stress-${width}x${height}`);
  }
});
