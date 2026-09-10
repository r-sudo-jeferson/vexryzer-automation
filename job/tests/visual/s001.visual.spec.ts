import { expect, test } from '@playwright/test';

const viewports = [
  [1440, 1080], [1366, 768], [1024, 768], [768, 1024], [430, 932], [390, 844], [360, 800],
] as const;

for (const [width, height] of viewports) {
  test(`process ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('button', { name: /Explorar um processo/i }).click();
    await expect(page).toHaveScreenshot(`process-${width}x${height}.png`, { fullPage: true, animations: 'disabled' });
  });
}
