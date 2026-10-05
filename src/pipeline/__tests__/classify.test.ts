import { describe, it, expect } from 'vitest';
import { classifyImage } from '../classify';
import type { NormalizedImage } from '../types';

describe('Pipeline Stage 4: Classify', () => {
  it('classifies simple low-color graphics as line-art', () => {
    // 10x10 monochrome image (all black)
    const data = new Uint8ClampedArray(10 * 10 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }

    const normalized: NormalizedImage = {
      image: { data, width: 10, height: 10 },
      format: 'png',
      originalByteLength: 100,
      metadata: { hasAlpha: false },
    };

    const res = classifyImage(normalized);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.classification).toBe('line-art');
      expect(res.value.hasAlpha).toBe(false);
    }
  });

  it('detects alpha transparency in pixel buffer', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    data.fill(255);
    data[3] = 128; // semi-transparent pixel

    const normalized: NormalizedImage = {
      image: { data, width: 4, height: 4 },
      format: 'png',
      originalByteLength: 50,
      metadata: { hasAlpha: true },
    };

    const res = classifyImage(normalized);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.hasAlpha).toBe(true);
    }
  });
});
