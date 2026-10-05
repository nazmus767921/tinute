import { test, expect } from '@playwright/test';
test('makes expert choices optional and keeps their controls usable', async ({ page }) => {
  await page.goto('/');
  const format = page.getByRole('combobox', { name: 'Output format' });
  await expect(format).not.toBeVisible();
  await page.getByText('Advanced settings', { exact: true }).click();
  await format.click();
  await page.getByRole('option', { name: 'WEBP' }).click();
  await expect(format).toHaveText('WEBP');
  const lossless = page.getByRole('radio', { name: /keep every detail/i });
  await lossless.click();
  await expect(lossless).toBeChecked();
  await expect(page.getByRole('slider', { name: /quality/i })).not.toBeVisible();
  await page.getByRole('radio', { name: /smaller file, same look/i }).click();
  await expect(page.getByRole('slider', { name: /quality/i })).toBeVisible();
  await page.getByRole('button', { name: 'Reset to recommended' }).click();
  await expect(format).toHaveText('Automatic (recommended)');
  await page.getByText('Advanced settings', { exact: true }).click();
  await expect(format).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose images', exact: true })).toBeVisible();
});

test('custom controls support phone taps, slider dragging, and keyboard selection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByText('Advanced settings', { exact: true }).click();
  const format = page.getByRole('combobox', { name: 'Output format' });
  await format.focus();
  await format.press('ArrowDown');
  await format.press('End');
  await format.press('Enter');
  await expect(format).toHaveText('BMP');
  await format.click();
  await page.getByRole('option', { name: 'PNG', exact: true }).click();
  await expect(format).toHaveText('PNG');
  const privacy = page.getByRole('checkbox', { name: 'Remove location and camera details' });
  await privacy.click();
  await expect(privacy).toHaveAttribute('aria-checked', 'false');
  const quality = page.getByRole('slider', { name: 'Quality' });
  await quality.scrollIntoViewIfNeeded();
  const track = await quality.locator('.custom-slider-track').boundingBox();
  if (!track) throw new Error('Slider track missing');
  await page.mouse.move(track.x + track.width * 0.25, track.y + track.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width * 0.75, track.y + track.height / 2);
  await page.mouse.up();
  await expect(quality).toHaveAttribute('aria-valuenow', '75');
  await quality.press('Home');
  await expect(quality).toHaveAttribute('aria-valuenow', '1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/tinute-320-custom-settings.png', fullPage: true });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await page.screenshot({ path: '/tmp/tinute-320-custom-settings-200.png', fullPage: true });
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll('body *'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
      })
      .map((el) => ({
        tag: el.tagName,
        className: el.className,
        text: el.textContent?.slice(0, 80),
        width: el.getBoundingClientRect().width,
      })),
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    JSON.stringify(overflow),
  ).toBe(true);
});
