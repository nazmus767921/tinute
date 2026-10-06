import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';

async function pngFixture(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#facc15';
    context.fillRect(0, 0, 32, 32);
    context.fillStyle = '#9333ea';
    context.fillRect(0, 0, 16, 32);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  return Buffer.from(base64, 'base64');
}

function addPrivateText(png: Buffer) {
  const payload = Buffer.from('Comment\0GPS_LOCATION_PRIVATE_TEST');
  const type = Buffer.from('tEXt');
  const body = Buffer.concat([type, payload]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const chunk = Buffer.alloc(payload.length + 12);
  chunk.writeUInt32BE(payload.length, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, chunk.length - 4);
  return Buffer.concat([png.subarray(0, png.length - 12), chunk, png.subarray(png.length - 12)]);
}

async function upload(
  page: Page,
  files: Array<{ name: string; mimeType: string; buffer: Buffer }>,
) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose images', exact: true }).click();
  await (await chooser).setFiles(files);
}

test('large PNG native streams preserve image dimensions and format', async ({ page }) => {
  await page.goto('/');
  const png = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 2000;
      canvas.height = 2100;
      const context = canvas.getContext('2d')!;
      const gradient = context.createLinearGradient(0, 0, 2000, 2100);
      gradient.addColorStop(0, '#137baf');
      gradient.addColorStop(1, '#fcba71');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 2000, 2100);
      return canvas.toDataURL('image/png').split(',')[1]!;
    }),
    'base64',
  );
  await upload(page, [{ name: 'large.png', mimeType: 'image/png', buffer: png }]);
  const action = page.getByRole('button', { name: 'Download image', exact: true });
  await expect(action).toBeVisible({ timeout: 30000 });
  const pending = page.waitForEvent('download');
  await action.click();
  const bytes = await readFile((await (await pending).path())!);
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.readUInt32BE(16)).toBe(2000);
  expect(bytes.readUInt32BE(20)).toBe(2100);
});

test('production workers remove private metadata and download valid output', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  const wasmFailures: string[] = [];
  page.on('response', (response) => {
    if (response.url().endsWith('.wasm') && !response.ok()) wasmFailures.push(response.url());
  });
  await upload(page, [
    { name: 'private.png', mimeType: 'image/png', buffer: addPrivateText(await pngFixture(page)) },
  ]);
  const action = page.getByRole('button', { name: 'Download image', exact: true });
  await expect(action).toBeVisible({ timeout: 60_000 });
  const event = page.waitForEvent('download');
  await action.click();
  const downloaded = await event;
  const bytes = await readFile((await downloaded.path())!);
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(bytes.includes(Buffer.from('GPS_LOCATION_PRIVATE_TEST'))).toBe(false);
  expect(downloaded.suggestedFilename()).toBe('private.optimized.png');
  expect(wasmFailures).toEqual([]);
  await page.getByRole('button', { name: 'Compare private.png' }).click();
  const slider = page.getByRole('slider', { name: 'Image comparison' });
  await expect(slider).toBeVisible();
  await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuenow', '51');
  await page.getByRole('button', { name: 'Close comparison' }).click();
});

test('explicit AVIF conversion uses the matching single-thread codec', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Advanced settings', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Output format' }).click();
  await page.getByRole('option', { name: 'AVIF', exact: true }).click();
  await upload(page, [
    { name: 'convert.png', mimeType: 'image/png', buffer: await pngFixture(page) },
  ]);
  const action = page.getByRole('button', { name: 'Download image', exact: true });
  await expect(action).toBeVisible({ timeout: 30000 });
  const pending = page.waitForEvent('download');
  await action.click();
  const downloaded = await pending;
  expect(downloaded.suggestedFilename()).toBe('convert.optimized.avif');
  const bytes = await readFile((await downloaded.path())!);
  expect(bytes.toString('ascii', 4, 8)).toBe('ftyp');
  expect(bytes.toString('ascii', 8, 12)).toBe('avif');
});

test('production batch exports a readable ZIP and rejects corrupt files with recovery', async ({
  page,
}) => {
  await page.goto('/');
  const png = await pngFixture(page);
  await upload(page, [
    { name: 'one.png', mimeType: 'image/png', buffer: png },
    { name: 'two.png', mimeType: 'image/png', buffer: png },
    { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid file') },
  ]);
  await expect(page.getByRole('button', { name: 'Try again broken.png' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole('button', { name: 'Download one.png' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole('button', { name: 'Download two.png' })).toBeVisible({
    timeout: 60_000,
  });
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download images', exact: true }).click();
  const bytes = await readFile((await (await event).path())!);
  const files = unzipSync(bytes);
  expect(Object.keys(files)).toHaveLength(2);
  expect(Object.keys(files).every((name) => /^(one|two)\.optimized\./.test(name))).toBe(true);
  expect(Object.values(files).every((file) => file.byteLength > 0)).toBe(true);
});

test('mixed uploads preserve JPEG and PNG formats by default', async ({ page }) => {
  await page.goto('/');
  const jpeg = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#184f92';
      context.fillRect(0, 0, 128, 128);
      return canvas.toDataURL('image/jpeg', 0.95).split(',')[1]!;
    }),
    'base64',
  );
  await upload(page, [
    { name: 'photo.jpeg', mimeType: 'image/jpeg', buffer: jpeg },
    { name: 'graphic.png', mimeType: 'image/png', buffer: await pngFixture(page) },
  ]);
  for (const [name, magic] of [
    ['photo.jpeg', 'jpeg'],
    ['graphic.png', 'png'],
  ] as const) {
    const action = page.getByRole('button', { name: `Download ${name}`, exact: true });
    await expect(action).toBeVisible({ timeout: 30000 });
    const pending = page.waitForEvent('download');
    await action.click();
    const downloaded = await pending;
    expect(downloaded.suggestedFilename()).toBe(name.replace('.', '.optimized.'));
    const bytes = await readFile((await downloaded.path())!);
    if (magic === 'jpeg') expect([...bytes.subarray(0, 2)]).toEqual([255, 216]);
    else expect([...bytes.subarray(0, 4)]).toEqual([137, 80, 78, 71]);
  }
});
