import { describe, it, expect, vi } from 'vitest';
import { webpCodec } from '../../codecs';
import { searchAndEncode } from '../search';
import type { NormalizedImage, PipelinePlan, UserPipelineSettings } from '../types';

function createTestImage(width = 32, height = 32): NormalizedImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = (x * 8) % 256;
      data[idx + 1] = (y * 8) % 256;
      data[idx + 2] = ((x + y) * 4) % 256;
      data[idx + 3] = 255;
    }
  }

  return {
    image: { data, width, height },
    format: 'png',
    originalByteLength: data.byteLength,
    metadata: { hasAlpha: false },
  };
}

describe('Pipeline Stage 6: Search & Encode (Target-Quality Search)', () => {
  it('corrects an optimistic sample using the full-image quality check', async () => {
    const normalized = createTestImage(640, 640);
    normalized.image.data.fill(255);
    const realDecode = webpCodec.decode.bind(webpCodec);
    let fullDecodes = 0;
    const decode = vi.spyOn(webpCodec, 'decode').mockImplementation(async (buffer) => {
      const image = await realDecode(buffer);
      if (image.width === 640 && ++fullDecodes === 1) {
        for (let i = 0; i < image.data.length; i += 4) {
          image.data[i] = image.data[i + 1] = image.data[i + 2] = 0;
        }
      }
      return image;
    });
    try {
      const res = await searchAndEncode(
        normalized,
        {
          targetFormat: 'webp',
          mode: 'visually-lossless',
          encodeOptions: {},
          candidateEncoders: ['webp'],
          classification: 'photo',
        },
        { targetFormat: 'webp', mode: 'visually-lossless', stripMetadata: true, qualityTarget: 80 },
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.qualityScore).toBeGreaterThanOrEqual(80);
      expect(res.value.qualityParam).toBeGreaterThan(35);
      expect(fullDecodes).toBeGreaterThan(1);
    } finally {
      decode.mockRestore();
    }
  });
  it('bounds trial pixel work while retaining full output dimensions and verified quality', async () => {
    const normalized = createTestImage(640, 640);
    for (let y = 0; y < 640; y++)
      for (let x = 0; x < 640; x++) {
        const i = (y * 640 + x) * 4;
        normalized.image.data[i] = Math.round((x * 255) / 639);
        normalized.image.data[i + 1] = Math.round((y * 255) / 639);
        normalized.image.data[i + 2] = Math.round(((x + y) * 255) / 1278);
      }
    const encode = vi.spyOn(webpCodec, 'encode');
    try {
      const res = await searchAndEncode(
        normalized,
        {
          targetFormat: 'webp',
          mode: 'visually-lossless',
          encodeOptions: {},
          candidateEncoders: ['webp'],
          classification: 'photo',
        },
        { targetFormat: 'webp', mode: 'visually-lossless', stripMetadata: true, qualityTarget: 80 },
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      const decoded = await webpCodec.decode(res.value.outputBuffer);
      expect([decoded.width, decoded.height]).toEqual([640, 640]);
      expect(res.value.qualityScore).toBeGreaterThanOrEqual(80);
      const processedPixels = encode.mock.calls.reduce(
        (sum, [image]) => sum + image.width * image.height,
        0,
      );
      expect(processedPixels).toBeLessThan(2_000_000);
    } finally {
      encode.mockRestore();
    }
  });

  it('rejects a final output that fails the full-image quality target even at maximum quality', async () => {
    const normalized = createTestImage(32, 32);
    const decode = vi.spyOn(webpCodec, 'decode').mockResolvedValue({
      width: 32,
      height: 32,
      data: new Uint8ClampedArray(32 * 32 * 4).fill(255),
    });
    try {
      const res = await searchAndEncode(
        normalized,
        {
          targetFormat: 'webp',
          mode: 'visually-lossless',
          encodeOptions: {},
          candidateEncoders: ['webp'],
          classification: 'photo',
        },
        { targetFormat: 'webp', mode: 'visually-lossless', stripMetadata: true, qualityTarget: 80 },
      );
      expect(res.ok).toBe(false);
    } finally {
      decode.mockRestore();
    }
  });
  it('performs binary search on WebP within 5-7 iterations and encodes at target quality', async () => {
    const normalized = createTestImage(32, 32);
    const plan: PipelinePlan = {
      targetFormat: 'webp',
      mode: 'visually-lossless',
      encodeOptions: { quality: 80, method: 4 },
      candidateEncoders: ['webp'],
      classification: 'photo',
    };
    const settings: UserPipelineSettings = {
      targetFormat: 'webp',
      mode: 'visually-lossless',
      stripMetadata: true,
      qualityTarget: 80,
    };

    const res = await searchAndEncode(normalized, plan, settings);
    expect(res.ok).toBe(true);

    if (res.ok) {
      expect(res.value.format).toBe('webp');
      expect(res.value.outputBuffer.byteLength).toBeGreaterThan(0);
      expect(res.value.iterations).toBeGreaterThanOrEqual(5);
      expect(res.value.iterations).toBeLessThanOrEqual(7);
      expect(res.value.qualityParam).toBeGreaterThanOrEqual(35);
      expect(res.value.qualityParam).toBeLessThanOrEqual(95);
      expect(res.value.qualityScore).toBeGreaterThanOrEqual(70);
      expect(res.value.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('skips binary search in lossless mode and verifies bit-exact pixel fidelity', async () => {
    const normalized = createTestImage(16, 16);
    const plan: PipelinePlan = {
      targetFormat: 'webp',
      mode: 'lossless',
      encodeOptions: { lossless: true, quality: 100, method: 4 },
      candidateEncoders: ['webp'],
      classification: 'illustration',
    };
    const settings: UserPipelineSettings = {
      targetFormat: 'webp',
      mode: 'lossless',
      stripMetadata: true,
    };

    const res = await searchAndEncode(normalized, plan, settings);
    expect(res.ok).toBe(true);

    if (res.ok) {
      expect(res.value.iterations).toBe(0);
      expect(res.value.qualityScore).toBe(100.0);
      expect(res.value.isLosslessBitExact).toBe(true);
      expect(res.value.qualityParam).toBe(100);
    }
  });

  it('handles PNG in visually-lossless mode with bit-exact lossless verification', async () => {
    const normalized = createTestImage(16, 16);
    const plan: PipelinePlan = {
      targetFormat: 'png',
      mode: 'visually-lossless',
      encodeOptions: { level: 2 },
      candidateEncoders: ['png'],
      classification: 'screenshot',
    };
    const settings: UserPipelineSettings = {
      targetFormat: 'png',
      mode: 'visually-lossless',
      stripMetadata: true,
    };

    const res = await searchAndEncode(normalized, plan, settings);
    expect(res.ok).toBe(true);

    if (res.ok) {
      expect(res.value.iterations).toBe(0);
      expect(res.value.isLosslessBitExact).toBe(true);
      expect(res.value.qualityScore).toBe(100.0);
    }
  });
});
