import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const axePaths = ['/', '/?fixture=longContent', '/?fixture=origin', '/?fixture=provenance', '/?fixture=duplicateLabels'] as const;

for (const path of axePaths) {
  test(`axe serious/critical = 0 for ${path}`, async ({ page }) => {
    await page.goto(path);
    if (path !== '/?fixture=origin') await page.getByRole('button', { name: /Explorar um processo/i }).click();
    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(severe).toEqual([]);
  });
}

async function tabUntilText(page: Page, pattern: RegExp, maxTabs = 80): Promise<void> {
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press('Tab');
    const text = await page.evaluate(() => document.activeElement?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    if (pattern.test(text)) return;
  }
  throw new Error(`Keyboard focus did not reach ${String(pattern)} within ${maxTabs} Tab presses`);
}

test('skip link transfers keyboard focus to the primary experience', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.locator('.vxa-skip');
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#vxa-primary')).toBeFocused();
});

test('keyboard-only path can enter, inspect and advance process focus', async ({ page }) => {
  await page.goto('/');
  await tabUntilText(page, /Explorar um processo/i, 12);
  const primary = page.getByRole('button', { name: /Explorar um processo/i });
  await expect(primary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Navegação dirigida do processo' })).toContainText('4 etapas mapeadas');

  await tabUntilText(page, /Conferência manual/i);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /02 Conferência manual/i })).toHaveAttribute('data-active', 'true');

  await tabUntilText(page, /^Próxima$/i);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /03 Lançamento no sistema/i })).toHaveAttribute('data-active', 'true');
});

test('forced 200% text enlargement preserves content access without horizontal document overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?fixture=longContent');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await page.getByRole('button', { name: /Recebimento de documentos fiscais/i }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: /Recebimento de documentos fiscais/i })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});

test('reduced motion keeps the same semantic controls and visible focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await tabUntilText(page, /Explorar um processo/i, 12);
  const primary = page.getByRole('button', { name: /Explorar um processo/i });
  await expect(primary).toBeFocused();
  await expect(primary).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(page.locator('.vxa-shell')).toHaveAttribute('data-motion', 'reduced');
});
