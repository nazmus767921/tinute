import { describe, it, expect } from 'vitest';
import { avifCodec } from '../avifCodec';
import { jxlCodec } from '../jxlCodec';
import { gifCodec } from '../gifCodec';
import { tiffCodec } from '../tiffCodec';
import { bmpCodec } from '../bmpCodec';
import { svgCodec } from '../svgCodec';
import { heicCodec } from '../heicCodec';
import type { RawImage } from '../types';

describe('Tier 1 Codecs (Phase 3)', () => {
  // 4x4 test pattern with distinct colors and alpha
  const sampleImage: RawImage = {
    width: 4,
    height: 4,
    data: new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255, 255, 0, 255, 255, 0, 255,
      255, 255, 128, 128, 128, 255, 0, 0, 0, 255, 255, 255, 255, 255, 64, 64, 64, 255, 192, 192,
      192, 255, 255, 128, 0, 255, 0, 128, 255, 255, 128, 0, 255, 255, 255, 0, 128, 255, 0, 255, 128,
      255,
    ]),
  };

  it('AVIF: encodes and decodes round-trip via WASM', async () => {
    const encoded = await avifCodec.encode(sampleImage, { quality: 65, speed: 8 });
    expect(encoded).toBeInstanceOf(ArrayBuffer);
    expect(encoded.byteLength).toBeGreaterThan(0);

    const decoded = await avifCodec.decode(encoded);
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(4);
    expect(decoded.data.length).toBe(4 * 4 * 4);
  });

  it('JXL: encodes and decodes round-trip via WASM', async () => {
    const encoded = await jxlCodec.encode(sampleImage, { quality: 80, effort: 3 });
    expect(encoded).toBeInstanceOf(ArrayBuffer);
    expect(encoded.byteLength).toBeGreaterThan(0);

    const decoded = await jxlCodec.decode(encoded);
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(4);
    expect(decoded.data.length).toBe(4 * 4 * 4);
  });

  it('GIF: encodes, decodes, and inspects multi-frame metadata', async () => {
    const encoded = await gifCodec.encode(sampleImage);
    expect(encoded.byteLength).toBeGreaterThan(0);

    const decoded = await gifCodec.decode(encoded);
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(4);

    const meta = gifCodec.inspectGif(encoded);
    expect(meta.frameCount).toBe(1);
    expect(meta.frames).toHaveLength(1);
  });

  it('TIFF: encodes and decodes round-trip with UTIF', async () => {
    const encoded = await tiffCodec.encode(sampleImage);
    expect(encoded.byteLength).toBeGreaterThan(0);

    const decoded = await tiffCodec.decode(encoded);
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(4);
    // TIFF with UTIF preserves exact pixels
    expect(decoded.data[0]).toBe(sampleImage.data[0]);
    expect(decoded.data[1]).toBe(sampleImage.data[1]);
  });

  it('BMP: encodes and decodes 32-bit RGBA with bit-exact fidelity', async () => {
    const encoded = await bmpCodec.encode(sampleImage, { bitCount: 32 });
    expect(encoded.byteLength).toBe(54 + 4 * 4 * 4);

    const decoded = await bmpCodec.decode(encoded);
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(4);

    // Bit-exact verification for all 64 bytes
    for (let i = 0; i < sampleImage.data.length; i++) {
      expect(decoded.data[i]).toBe(sampleImage.data[i]);
    }
  });

  it('BMP: encodes and decodes 24-bit BGR with row padding', async () => {
    // 3x1 image: 3 pixels * 3 bytes = 9 bytes + 3 pad = 12 byte row
    const test3x1: RawImage = {
      width: 3,
      height: 1,
      data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]),
    };

    const encoded = await bmpCodec.encode(test3x1, { bitCount: 24 });
    expect(encoded.byteLength).toBe(54 + 12);

    const decoded = await bmpCodec.decode(encoded);
    expect(decoded.width).toBe(3);
    expect(decoded.height).toBe(1);
    expect(decoded.data[0]).toBe(255); // Red
    expect(decoded.data[1]).toBe(0);
    expect(decoded.data[2]).toBe(0);
    expect(decoded.data[4]).toBe(0); // Green
    expect(decoded.data[5]).toBe(255);
    expect(decoded.data[6]).toBe(0);
  });

  it('SVG: rasterizes vector SVG to raw RGBA pixels via Resvg WASM', async () => {
    const svgMarkup = `
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
        <rect width="10" height="10" fill="#ff0000" />
      </svg>
    `;
    const buffer = new TextEncoder().encode(svgMarkup).buffer;
    const decoded = await svgCodec.decode(buffer);

    expect(decoded.width).toBe(10);
    expect(decoded.height).toBe(10);
    expect(decoded.data.length).toBe(10 * 10 * 4);
    // Red rectangle
    expect(decoded.data[0]).toBe(255);
    expect(decoded.data[1]).toBe(0);
    expect(decoded.data[2]).toBe(0);
    expect(decoded.data[3]).toBe(255);
  });

  it('HEIC: rejects invalid or truncated buffers safely', async () => {
    const corruptBuffer = new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 104, 101, 105, 99])
      .buffer;
    await expect(heicCodec.decode(corruptBuffer)).rejects.toThrow();
  });

  it('HEIC & SVG: enforce decode-only constraint', async () => {
    expect(heicCodec.canEncode).toBe(false);
    expect(svgCodec.canEncode).toBe(false);
    await expect(heicCodec.encode(sampleImage)).rejects.toThrow(/decode-only/);
    await expect(svgCodec.encode(sampleImage)).rejects.toThrow(/rasterize-only/);
  });
});
