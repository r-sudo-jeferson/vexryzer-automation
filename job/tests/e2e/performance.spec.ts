import { expect, test } from '@playwright/test';

test('stress interactions expose render/viewport/camera evidence through the opt-in probe', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();

  await page.goto('/?fixture=stress&perf=1');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();

  const canvas = page.locator('.vxa-canvas');
  await canvas.hover();
  for (let index = 0; index < 12; index += 1) await page.mouse.wheel(0, -90);
  for (let index = 0; index < 12; index += 1) await page.mouse.wheel(0, 90);

  for (const step of [1, 6, 11, 16, 20]) {
    const target = page.locator('.vxa-step').nth(step - 1);
    await target.scrollIntoViewIfNeeded();
    await target.click();
  }

  const metrics = await page.evaluate(() => window.__VXA_PERF__);
  expect(metrics).toBeTruthy();
  expect(metrics!.canvasCommits).toBeGreaterThan(0);
  expect(metrics!.viewportEvents).toBeGreaterThan(0);
  expect(metrics!.cameraCommands).toBeGreaterThanOrEqual(6);
  expect(metrics!.semanticBandChanges).toBeLessThanOrEqual(metrics!.viewportEvents);
  expect(metrics!.lastLongTaskMs).toBeGreaterThanOrEqual(0);

  await testInfo.attach('performance-probe.json', {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });
});

test('repeated focus/unfocus exposes post-GC heap evidence without breaking the directed path', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();

  const session = await page.context().newCDPSession(page);
  await page.goto('/?fixture=stress&perf=1');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();

  const heap = async () => {
    await session.send('HeapProfiler.collectGarbage');
    return session.send('Runtime.getHeapUsage') as Promise<{ usedSize: number; totalSize: number }>;
  };

  const snapshots: Array<{ phase: string; usedSize: number; totalSize: number }> = [];
  snapshots.push({ phase: 'warm', ...(await heap()) });

  for (let phase = 1; phase <= 3; phase += 1) {
    for (let index = 0; index < 20; index += 1) {
      const target = page.locator('.vxa-step').nth(index);
      await target.scrollIntoViewIfNeeded();
      await target.click();
      await page.getByRole('button', { name: 'Ver processo' }).click();
    }
    snapshots.push({ phase: `cycle-${phase}`, ...(await heap()) });
  }

  await expect(page.getByRole('navigation', { name: 'Navegação dirigida do processo' })).toContainText('20 etapas mapeadas');
  for (const snapshot of snapshots) {
    expect(Number.isFinite(snapshot.usedSize)).toBe(true);
    expect(Number.isFinite(snapshot.totalSize)).toBe(true);
  }

  await testInfo.attach('heap-probe.json', {
    body: JSON.stringify(snapshots, null, 2),
    contentType: 'application/json',
  });
});
