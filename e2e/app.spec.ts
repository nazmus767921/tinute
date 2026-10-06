import { test, expect } from '@playwright/test';
test('keeps security headers, native upload access, and theme preferences', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['cross-origin-opener-policy']).toBe('same-origin');
  expect(response?.headers()['cross-origin-embedder-policy']).toBe('require-corp');
  expect(response?.headers()['cross-origin-resource-policy']).toBe('same-origin');
  const productionScripts = page.locator('script[src*="/assets/index-"]');
  if (await productionScripts.count()) {
    const script = await productionScripts.getAttribute('src');
    const asset = await page.request.get(script!);
    expect(asset.headers()['cache-control']).toContain('immutable');
    const conditional = await page.request.get(script!, {
      headers: { 'If-None-Match': asset.headers()['etag']! },
    });
    expect(conditional.status()).toBe(304);
    expect(conditional.headers()['cross-origin-resource-policy']).toBe('same-origin');
    expect(conditional.headers()['cross-origin-embedder-policy']).toBe('require-corp');
  }
  await expect(page).toHaveTitle(/Tinute/i);
  await expect(page.locator('html')).toHaveClass(/dark/);
  const choose = page.getByRole('button', { name: 'Choose images', exact: true });
  await choose.focus();
  await expect(choose).toBeFocused();
  await page.getByRole('radio', { name: 'Light theme' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByRole('radio', { name: 'Dark theme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});
