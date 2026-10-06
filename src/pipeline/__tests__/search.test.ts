import { describe, it, expect } from 'vitest';
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
