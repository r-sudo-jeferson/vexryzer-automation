import { expect, test, type Page } from '@playwright/test';

async function probe(page: Page) {
  const metrics = await page.evaluate(() => window.__VXA_PERF__);
  expect(metrics).toBeTruthy();
  return metrics!;
}

async function explore(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(String(error)));
  await page.goto('/?perf=1', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await page.locator('.vxa-step').first().click();
  return failures;
}

test('wheel claims the camera exactly once until explicit navigation re-engages it', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();
  const failures = await explore(page);
  const canvas = page.locator('.vxa-canvas');
  await canvas.hover();

  const baseline = await probe(page);
  for (let index = 0; index < 3; index += 1) await page.mouse.wheel(0, -90);
  await page.waitForTimeout(120);

  const interrupted = await probe(page);
  expect(interrupted.cameraInterruptions).toBe(baseline.cameraInterruptions + 1);

  await page.locator('.vxa-step').nth(1).click();
  await page.waitForTimeout(120);
  const reengaged = await probe(page);
  expect(reengaged.cameraCommands).toBeGreaterThan(baseline.cameraCommands);
  expect(failures).toEqual([]);

  await testInfo.attach('camera-wheel-interruption.json', {
    body: JSON.stringify({ baseline, interrupted, reengaged }, null, 2),
    contentType: 'application/json',
  });
  await page.screenshot({ path: testInfo.outputPath('camera-after-interrupt.png') });
});

test('viewport keys interrupt without any pointer, and hover alone never claims the camera', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();
  const failures = await explore(page);
  const baseline = await probe(page);

  const canvas = page.locator('.vxa-canvas');
  await canvas.hover();
  await page.waitForTimeout(120);
  const afterHover = await probe(page);
  expect(afterHover.cameraInterruptions).toBe(baseline.cameraInterruptions);

  await canvas.dispatchEvent('keydown', { key: 'ArrowDown' });
  await canvas.dispatchEvent('keydown', { key: 'ArrowDown' });
  await page.waitForTimeout(120);
  const afterKeys = await probe(page);
  expect(afterKeys.cameraInterruptions).toBe(baseline.cameraInterruptions + 1);
  expect(failures).toEqual([]);

  await testInfo.attach('camera-keyboard-interruption.json', {
    body: JSON.stringify({ baseline, afterHover, afterKeys }, null, 2),
    contentType: 'application/json',
  });
});

test('focusing the composer claims the camera and freezes further commands', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();
  const failures = await explore(page);
  const baseline = await probe(page);

  await page.locator('#vxa-agent-input').click();
  await page.waitForTimeout(400);
  const afterFocus = await probe(page);
  expect(afterFocus.cameraInterruptions).toBe(baseline.cameraInterruptions + 1);
  expect(afterFocus.cameraCommands).toBe(baseline.cameraCommands);
  expect(failures).toEqual([]);

  await testInfo.attach('camera-focus-interruption.json', {
    body: JSON.stringify({ baseline, afterFocus }, null, 2),
    contentType: 'application/json',
  });
});

test('reduced motion keeps directed navigation working without errors', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const failures = await explore(page);
  await page.locator('.vxa-step').nth(2).click();
  const metrics = await probe(page);
  expect(metrics.cameraCommands).toBeGreaterThan(0);
  expect(failures).toEqual([]);
  expect(metrics.cameraInterruptions).toBeGreaterThanOrEqual(0);
  await testInfo.attach('camera-reduced-motion.json', {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });
});

test('mobile smoke: directed canvas loads, navigates and renders without errors', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('mobile')) test.skip();
  const failures = await explore(page);
  await page.locator('.vxa-step').nth(1).click();
  const metrics = await probe(page);
  expect(metrics.cameraCommands).toBeGreaterThan(0);
  expect(failures).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('camera-mobile-smoke.png') });
  await testInfo.attach('camera-mobile-probe.json', {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });
});
