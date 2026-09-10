import { expect, test } from '@playwright/test';

const mobileViewports = [
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;

test('origin exposes one primary invitation and process can be inspected without canvas gestures', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Onde o seu time ainda trabalha como máquina/i })).toBeVisible();
  const primary = page.getByRole('button', { name: /Explorar um processo/i });
  await expect(primary).toBeVisible();
  await expect(page.locator('.vxa-step')).toHaveCount(0);
  await expect(page.locator('.vxa-actions button')).toHaveCount(1);
  await primary.click();
  await expect(page.getByRole('navigation', { name: 'Navegação dirigida do processo' })).toContainText('4 etapas mapeadas');
  await page.getByRole('button', { name: /02 Conferência manual/i }).click();
  await expect(page.getByRole('button', { name: 'Ver processo' })).toBeVisible();
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByRole('button', { name: /03 Lançamento no sistema/i })).toHaveAttribute('data-active', 'true');
});

test('GAUNTLET fixtures cover single, stress, long-content, duplicate-label and provenance states', async ({ page }) => {
  await page.goto('/?fixture=single');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await expect(page.locator('.vxa-step')).toHaveCount(1);

  await page.goto('/?fixture=stress');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await expect(page.locator('.vxa-step')).toHaveCount(20);

  await page.goto('/?fixture=longContent');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await expect(page.getByRole('button', { name: /Recebimento de documentos fiscais/i })).toBeVisible();

  await page.goto('/?fixture=duplicateLabels');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  const duplicates = page.getByRole('button', { name: /Conferência manual/i });
  await expect(duplicates).toHaveCount(2);
  await duplicates.nth(1).click();
  await expect(duplicates.nth(1)).toHaveAttribute('data-active', 'true');
  await expect(duplicates.nth(0)).toHaveAttribute('data-active', 'false');

  await page.goto('/?fixture=provenance');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await page.getByRole('button', { name: /Sistema a confirmar/i }).click();
  await expect(page.getByText('Hipótese', { exact: true })).toBeVisible();
});

test('reduced motion preserves the complete directed journey', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.vxa-shell')).toHaveAttribute('data-motion', 'reduced');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await page.getByRole('button', { name: /01 Documentos recebidos/i }).click();
  await expect(page.getByRole('button', { name: 'Ver processo' })).toBeVisible();
});

test('mobile has no horizontal dependency and late stress steps remain directly reachable', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('mobile')) test.skip();

  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport);
    await page.goto('/?fixture=stress');
    await page.getByRole('button', { name: /Explorar um processo/i }).click();

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    const stepList = page.locator('.vxa-director__steps');
    const stepListDimensions = await stepList.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(stepListDimensions.scrollWidth).toBeLessThanOrEqual(stepListDimensions.clientWidth + 1);

    const lastStep = page.getByRole('button', { name: /20 Saída consolidada/i });
    await lastStep.scrollIntoViewIfNeeded();
    await lastStep.click();
    await expect(lastStep).toHaveAttribute('data-active', 'true');
    await expect(page.getByRole('button', { name: 'Anterior' })).toBeVisible();
  }
});

test('visual state survives refresh and browser history navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await expect(page).toHaveURL(/#process$/);
  await page.getByRole('button', { name: /02 Conferência manual/i }).click();
  await expect(page).toHaveURL(/#focus=manual-review$/);
  await page.reload();
  await expect(page.getByRole('button', { name: /02 Conferência manual/i })).toHaveAttribute('data-active', 'true');
  await page.goBack();
  await expect(page).toHaveURL(/#process$/);
  await expect(page.getByRole('button', { name: 'Ver processo' })).toHaveCount(0);
});

test('performance probe is absent by default and enabled only for GAUNTLET measurement', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => typeof window.__VXA_PERF__)).toBe('undefined');

  await page.goto('/?perf=1');
  await expect.poll(() => page.evaluate(() => Boolean(window.__VXA_PERF__))).toBe(true);
  const budgets = await page.evaluate(() => window.__VXA_PERF__?.budgets);
  expect(budgets).toMatchObject({ lcpMs: 2500, inpMs: 200, cls: 0.1, longTaskMs: 50 });
});

test('error recovery clears the failing fixture and returns to a safe origin state', async ({ page }) => {
  await page.goto('/?fixture=error#process');
  await expect(page.getByRole('alert')).toContainText('A experiência visual encontrou um problema.');
  await page.getByRole('button', { name: 'Reiniciar experiência' }).click();
  await expect(page.getByRole('heading', { name: /Onde o seu time ainda trabalha como máquina/i })).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({ search: window.location.search, hash: window.location.hash }))).toEqual({
    search: '',
    hash: '#origin',
  });
});
