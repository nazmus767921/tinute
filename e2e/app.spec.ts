import { test, expect } from '@playwright/test';
test('keeps security headers, native upload access, and theme preferences', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['cross-origin-opener-policy']).toBe('same-origin');
  expect(response?.headers()['cross-origin-embedder-policy']).toBe('require-corp');
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
