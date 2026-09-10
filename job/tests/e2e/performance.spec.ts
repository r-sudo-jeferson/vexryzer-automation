import { expect, test } from '@playwright/test';

function percentile75(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.75) - 1);
  return sorted[index] ?? Number.POSITIVE_INFINITY;
}

test('production-like lab samples keep LCP, interaction latency and CLS inside S001 budgets', async ({ page }, testInfo) => {
  const session = await page.context().newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 40,
    downloadThroughput: 1_250_000,
    uploadThroughput: 625_000,
    connectionType: 'wifi',
  });

  const samples: Array<{ lcpMs: number; inpMs: number; cls: number }> = [];
  let budgets: { lcpMs: number; inpMs: number; cls: number } | null = null;

  for (let sample = 0; sample < 5; sample += 1) {
    await page.goto('/?perf=1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(80);

    await page.getByRole('button', { name: /Explorar um processo/i }).click();
    await page.locator('.vxa-step').first().click();
    await page.waitForTimeout(80);

    const metrics = await page.evaluate(() => window.__VXA_PERF__);
    expect(metrics).toBeTruthy();
    expect(metrics!.supportedEntryTypes).toEqual(expect.arrayContaining([
      'largest-contentful-paint',
      'layout-shift',
      'event',
    ]));
    expect(metrics!.observedEntryTypes).toEqual(expect.arrayContaining([
      'largest-contentful-paint',
      'layout-shift',
      'event',
      'first-input',
    ]));
    expect(metrics!.lcpMs).not.toBeNull();

    budgets = metrics!.budgets;
    samples.push({
      lcpMs: metrics!.lcpMs!,
      // Event Timing only surfaces interactions at/above the configured 16 ms threshold.
      // No observed event therefore has a conservative <=16 ms upper bound for this lab guard.
      inpMs: metrics!.inpMs ?? 16,
      cls: metrics!.cls,
    });
  }

  expect(budgets).toBeTruthy();
  const p75 = {
    lcpMs: percentile75(samples.map((sample) => sample.lcpMs)),
    inpMs: percentile75(samples.map((sample) => sample.inpMs)),
    cls: percentile75(samples.map((sample) => sample.cls)),
  };

  expect(p75.lcpMs).toBeLessThan(budgets!.lcpMs);
  expect(p75.inpMs).toBeLessThan(budgets!.inpMs);
  expect(p75.cls).toBeLessThan(budgets!.cls);

  await testInfo.attach('web-vitals-lab-p75.json', {
    body: JSON.stringify({
      profile: { latencyMs: 40, downloadBytesPerSecond: 1_250_000, uploadBytesPerSecond: 625_000 },
      project: testInfo.project.name,
      samples,
      p75,
      budgets,
    }, null, 2),
    contentType: 'application/json',
  });
});

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

test('repeated focus/unfocus reaches a post-warmup heap plateau and preserves the directed path', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();
  test.setTimeout(60_000);

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

  const postWarmup = snapshots[1]!;
  const final = snapshots.at(-1)!;
  const allowedGrowthBytes = Math.max(2 * 1024 * 1024, Math.round(postWarmup.usedSize * 0.15));
  const observedGrowthBytes = Math.max(0, final.usedSize - postWarmup.usedSize);
  expect(observedGrowthBytes).toBeLessThanOrEqual(allowedGrowthBytes);

  await testInfo.attach('heap-probe.json', {
    body: JSON.stringify({ snapshots, postWarmupPhase: postWarmup.phase, observedGrowthBytes, allowedGrowthBytes }, null, 2),
    contentType: 'application/json',
  });
});
