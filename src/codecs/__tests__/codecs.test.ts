import { describe, it, expect } from 'vitest';
import { jpegCodec } from '../jpegCodec';
import { pngCodec } from '../pngCodec';
import { webpCodec } from '../webpCodec';
import type { RawImage } from '../types';

describe('WebAssembly Codecs Tier 1 (JPEG, PNG, WebP)', () => {
  // Simple 4x4 test pattern
  const createPattern = (): RawImage => {
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 17) % 255;
      data[i + 1] = (i * 31) % 255;
      data[i + 2] = (i * 47) % 255;
      data[i + 3] = 255;
    }
    return { data, width, height };
  };

  it('JPEG: encodes and decodes round-trip with MozJPEG WASM', async () => {
    const pattern = createPattern();
    const encodedBuffer = await jpegCodec.encode(pattern, { quality: 85 });
    expect(encodedBuffer.byteLength).toBeGreaterThan(0);

    const decoded = await jpegCodec.decode(encodedBuffer);
    expect(decoded.width).toBe(pattern.width);
    expect(decoded.height).toBe(pattern.height);
    expect(decoded.data.length).toBe(pattern.data.length);
  });

  it('PNG & OxiPNG: encodes, optimizes, and decodes with Squoosh WASM', async () => {
    const pattern = createPattern();
    const encodedBuffer = await pngCodec.encode(pattern, { level: 2 });
    expect(encodedBuffer.byteLength).toBeGreaterThan(0);

    const decoded = await pngCodec.decode(encodedBuffer);
    expect(decoded.width).toBe(pattern.width);
    expect(decoded.height).toBe(pattern.height);
  });

  it('WebP: encodes and decodes round-trip with libwebp WASM', async () => {
    const pattern = createPattern();
    const encodedBuffer = await webpCodec.encode(pattern, { quality: 80 });
    expect(encodedBuffer.byteLength).toBeGreaterThan(0);

    const decoded = await webpCodec.decode(encodedBuffer);
    expect(decoded.width).toBe(pattern.width);
    expect(decoded.height).toBe(pattern.height);
  });
});
