import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const path of ['/', '/?fixture=longContent', '/?fixture=origin']) {
  test(`axe serious/critical = 0 for ${path}`, async ({ page }) => {
    await page.goto(path);
    if (path !== '/?fixture=origin') await page.getByRole('button', { name: /Explorar um processo/i }).click();
    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(severe).toEqual([]);
  });
}

test('keyboard can enter the process without pointer input', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.vxa-skip')).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const primary = page.getByRole('button', { name: /Explorar um processo/i });
  await expect(primary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Navegação dirigida do processo' })).toContainText('4 etapas mapeadas');
});
