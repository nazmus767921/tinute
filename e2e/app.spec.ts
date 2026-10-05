import { test, expect } from '@playwright/test';

test.describe('Tinute Phase 0 Instrument Panel & Security', () => {
  test('serves COOP/COEP security headers and initializes in dark mode', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();
    expect(response?.status()).toBe(200);

    // Verify COOP/COEP headers
    const headers = response?.headers() ?? {};
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(headers['cross-origin-embedder-policy']).toBe('require-corp');

    // Verify Page Title
    await expect(page).toHaveTitle(/Tinute/i);

    // Verify dark mode default at launch
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);

    // Verify dropzone presence and keyboard accessibility
    const dropzone = page.getByRole('region', { name: /image dropzone/i });
    await expect(dropzone).toBeVisible();
    await expect(dropzone).toHaveAttribute('tabindex', '0');

    // Focus dropzone using keyboard Tab
    await dropzone.focus();
    await expect(dropzone).toBeFocused();

    // Verify theme toggle functionality
    const lightRadio = page.getByRole('radio', { name: /light/i });
    await lightRadio.click();
    await expect(html).not.toHaveClass(/dark/);

    const darkRadio = page.getByRole('radio', { name: /dark/i });
    await darkRadio.click();
    await expect(html).toHaveClass(/dark/);
  });
});
