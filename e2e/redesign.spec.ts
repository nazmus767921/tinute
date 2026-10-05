import { test, expect, type Page } from '@playwright/test';

async function seedJobs(page: Page, states = ['done', 'done', 'processing', 'error']) {
  await page.evaluate(async (statuses) => {
    const modulePath =
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => name.includes('/src/store/pipelineStore.ts'))
        .at(-1) ?? '/src/store/pipelineStore.ts';
    const { usePipelineStore } = await import(/* @vite-ignore */ modulePath);
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 120, 120);
    ctx.fillStyle = '#4f46e5';
    ctx.fillRect(20, 20, 80, 80);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
    const buffer = await blob.arrayBuffer();
    usePipelineStore.setState({
      jobs: statuses.map((status, i) => ({
        id: String(i),
        file: new File([blob], 'photo.png', { type: 'image/png' }),
        name:
          i === 0
            ? 'our-family-holiday-with-a-very-long-filename-that-still-needs-to-be-readable-on-a-small-phone.png'
            : `image-${i + 1}.png`,
        originalSize: 2400000,
        status,
        error:
          status === 'error'
            ? { code: 'DECODE_ERROR', message: 'We couldn’t read this image.' }
            : null,
        result:
          status === 'done'
            ? {
                id: String(i),
                outputBuffer: buffer,
                originalFormat: 'png',
                outputFormat: 'png',
                originalSize: 2400000,
                finalSize: 860000,
                savedBytes: 1540000,
                savingsPercentage: 64,
                neverBiggerTriggered: false,
                generationalLossWarning: false,
                qualityScore: 88,
                isLosslessBitExact: false,
                classification: 'photo',
                mode: 'visually-lossless',
                metadataReport: { gpsRemoved: true, exifRemoved: true, iccPreserved: true },
                durationMs: 10,
              }
            : null,
      })),
      selectedCompareJobId: null,
      isProcessing: statuses.includes('processing'),
      batchError: null,
      isZipping: false,
      zipError: null,
    });
  }, states);
}

for (const width of [320, 390, 768, 1440]) {
  test(`deliberate layouts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Choose images', exact: true })).toBeVisible();
    if (width < 400)
      expect((await page.getByRole('heading', { level: 1 }).boundingBox())!.height).toBeLessThan(
        90,
      );
    for (const theme of ['light', 'dark']) {
      await page
        .getByRole('radio', { name: theme === 'light' ? 'Light theme' : 'Dark theme' })
        .click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({ path: `/tmp/tinute-${width}-${theme}-empty.png`, fullPage: true });
    }
    await seedJobs(page);
    await expect(page.getByRole('progressbar', { name: 'Images finished' })).toHaveAttribute(
      'aria-valuenow',
      '75',
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: 'Download ready images' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Download ready images' })).toBeInViewport();
    const last = page.getByRole('article').last();
    await last.scrollIntoViewIfNeeded();
    const box = await last.boundingBox();
    const action = await page.getByRole('region', { name: 'Download your images' }).boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(action!.y + 1);
    await page.screenshot({ path: `/tmp/tinute-${width}-results.png`, fullPage: true });
    await page.getByRole('button', { name: /Compare our-family/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Compare images' });
    await expect(dialog).toBeVisible();
    if (width < 720) {
      const modalBox = await dialog.boundingBox();
      expect(modalBox!.y).toBe(0);
      expect(modalBox!.height).toBe(844);
    }
    const range = page.getByRole('slider', { name: 'Image comparison' });
    await expect(range).toBeVisible();
    await range.focus();
    await page.keyboard.press('ArrowRight');
    await expect(range).toHaveAttribute('aria-valuenow', '51');
    await page.screenshot({ path: `/tmp/tinute-${width}-compare.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Compare our-family/ })).toBeFocused();
  });
}

test('real local upload to download without opening expert controls', async ({ page }) => {
  await page.goto('/');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 64, 64);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  const chooserPromise = page.waitForEvent('filechooser');
  const choose = page.getByRole('button', { name: 'Choose images', exact: true });
  await page.keyboard.press('Tab');
  await choose.focus();
  await expect(choose).toBeFocused();
  expect(await choose.evaluate((el) => getComputedStyle(el).outlineWidth)).toBe('2px');
  await choose.press('Enter');
  await (
    await chooserPromise
  ).setFiles({
    name: 'sample.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.getByRole('button', { name: 'Download image', exact: true })).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download image', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/sample\.optimized\./);
});

test('mobile landscape, enlarged text, reduced motion, and guarded clearing', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await seedJobs(page, ['done', 'done']);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Download images', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Download images', exact: true })).toBeInViewport();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Clear finished images' }).click();
  await expect(page.getByRole('article')).toHaveCount(2);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Clear finished images' }).click();
  await expect(page.getByRole('button', { name: 'Choose images', exact: true })).toBeVisible();
});

test('measures rendered contrast and verifies tactile feedback with slowed motion', async ({
  page,
}) => {
  await page.goto('/');
  const measurements: Record<string, Record<string, number>> = {};
  for (const theme of ['light', 'dark']) {
    await page
      .getByRole('radio', { name: theme === 'light' ? 'Light theme' : 'Dark theme' })
      .click();
    measurements[theme] = await page.evaluate(() => {
      const rgb = (value: string) =>
        value
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number);
      const lum = (c: number[]) =>
        c
          .map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i]!, 0);
      const contrast = (el: Element) => {
        const style = getComputedStyle(el);
        let parent: Element | null = el;
        let background = 'rgba(0, 0, 0, 0)';
        while (parent) {
          const candidate = getComputedStyle(parent).backgroundColor;
          if (candidate !== 'rgba(0, 0, 0, 0)') {
            background = candidate;
            break;
          }
          parent = parent.parentElement;
        }
        const a = lum(rgb(style.color)),
          b = lum(rgb(background));
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      };
      return {
        primary: contrast(document.querySelector('.upload-button')!),
        body: contrast(document.querySelector('.upload-stage p')!),
        heading: contrast(document.querySelector('h1')!),
        settings: contrast(document.querySelector('.disclosure-summary')!),
      };
    });
    for (const ratio of Object.values(measurements[theme]!))
      expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
  await seedJobs(page, ['done', 'error']);
  for (const theme of ['light', 'dark']) {
    await page
      .getByRole('radio', { name: theme === 'light' ? 'Light theme' : 'Dark theme' })
      .click();
    measurements[`results-${theme}`] = await page.evaluate(() => {
      const toRgb = (v: string) =>
        v
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number);
      const lum = (v: number[]) =>
        v
          .map((c) => {
            c /= 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i]!, 0);
      const pair = (selector: string) => {
        const el = document.querySelector(selector)!;
        const fg = lum(toRgb(getComputedStyle(el).color));
        const bg = lum(toRgb(getComputedStyle(el.closest('.result-card')!).backgroundColor));
        return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      };
      return { savings: pair('.result-card .text-savings-text'), warning: pair('.result-warning') };
    });
    for (const ratio of Object.values(measurements[`results-${theme}`]!))
      expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
  console.log('Rendered contrast ratios', measurements);
  const button = page.getByRole('button', { name: 'Download image', exact: true });
  await button.scrollIntoViewIfNeeded();
  await button.hover();
  await page.mouse.down();
  await button.evaluate((el) => {
    el.getAnimations().forEach((animation) => {
      animation.playbackRate = 0.1;
    });
  });
  await page.waitForTimeout(1800);
  expect(await button.evaluate((el) => getComputedStyle(el).transform)).toMatch(/0\.96/);
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await button.hover();
  await page.mouse.down();
  expect(await button.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  await page.mouse.move(0, 0);
  await page.mouse.up();
});
