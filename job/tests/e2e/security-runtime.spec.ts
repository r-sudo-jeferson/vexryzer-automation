import { expect, test } from '@playwright/test';

test('representative S001 journey performs no external runtime request', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:4173') externalRequests.push(request.url());
  });

  await page.goto('/?fixture=stress');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await page.getByRole('button', { name: /06 Ponto de dúvida 6/i }).click();
  await page.getByRole('button', { name: 'Ver processo' }).click();
  expect(externalRequests).toEqual([]);
});

test('markup-shaped fixture content remains literal text and cannot execute', async ({ page }) => {
  await page.goto('/?fixture=adversarialText');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();

  const markupPattern = /<img src=x onerror=/i;
  const markupHeading = page.getByRole('heading', { name: markupPattern });
  const markupStep = page.getByRole('button', { name: /01 <img src=x onerror=/i });
  await expect(markupHeading).toBeVisible();
  await expect(markupStep).toBeVisible();
  await markupStep.click();

  await expect(page.getByText(/<script>window\.__VXA_INJECTED__=true<\/script>/i)).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.locator('script:not([src])')).toHaveCount(0);
  expect(await page.evaluate(() => Object.hasOwn(window, '__VXA_INJECTED__'))).toBe(false);
});
