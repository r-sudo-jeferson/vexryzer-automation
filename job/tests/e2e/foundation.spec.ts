import { expect, test } from '@playwright/test';

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

test('stress and long-content fixtures remain reachable through directed controls', async ({ page }) => {
  await page.goto('/?fixture=stress');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await expect(page.locator('.vxa-step')).toHaveCount(20);
  await page.goto('/?fixture=longContent');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await expect(page.getByRole('button', { name: /Recebimento de documentos fiscais/i })).toBeVisible();
});

test('reduced motion preserves the complete directed journey', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.vxa-shell')).toHaveAttribute('data-motion', 'reduced');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await page.getByRole('button', { name: /01 Documentos recebidos/i }).click();
  await expect(page.getByRole('button', { name: 'Ver processo' })).toBeVisible();
});

test('mobile has no layout horizontal overflow and does not require pinch or pan', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('mobile')) test.skip();
  await page.goto('/');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  await page.getByRole('button', { name: /01 Documentos recebidos/i }).click();
  await expect(page.getByRole('button', { name: 'Próxima' })).toBeVisible();
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
