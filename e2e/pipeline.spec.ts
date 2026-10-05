import { test, expect } from '@playwright/test';

test.describe('Tinute Phase 1 Pipeline Workspace & Controls', () => {
  test('allows configuring format, compression mode, and dropzone interaction', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Verify format selector interaction
    const formatSelect = page.getByRole('combobox', { name: /target format/i });
    await expect(formatSelect).toBeVisible();
    await formatSelect.selectOption('webp');
    await expect(formatSelect).toHaveValue('webp');

    // 2. Verify mode toggle
    const losslessBtn = page.getByRole('radio', { name: /^bit-exact lossless$/i });
    await losslessBtn.click();
    await expect(losslessBtn).toHaveAttribute('aria-checked', 'true');

    // Quality slider should be hidden in Lossless mode
    const qualitySlider = page.locator('#quality-slider');
    await expect(qualitySlider).not.toBeVisible();

    // Toggle back to Visually Lossless
    const visualBtn = page.getByRole('radio', { name: /visually lossless/i });
    await visualBtn.click();
    await expect(qualitySlider).toBeVisible();

    // 3. Verify Dropzone accessibility
    const dropzone = page.getByRole('region', { name: /image dropzone/i });
    await expect(dropzone).toBeVisible();
    await dropzone.focus();
    await expect(dropzone).toBeFocused();
  });
});
