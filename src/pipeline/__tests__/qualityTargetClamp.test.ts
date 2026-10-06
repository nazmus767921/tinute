import { describe, it, expect, vi } from 'vitest';
import { planOptimization } from '../plan';
import { searchAndEncode } from '../search';
import { encodeNative } from '../native';
import type { ClassificationResult, NormalizedImage, UserPipelineSettings } from '../types';
import { webpCodec } from '../../codecs';

describe('Quality target clamping for lossy compression', () => {
  const photoClassification: ClassificationResult = {
    classification: 'photo',
    uniqueColorCountEstimate: 10000,
    edgeDensity: 10,
    hasAlpha: false,
  };

  it.each(['jpeg', 'webp', 'avif', 'jxl'] as const)(
    'clamps qualityTarget: 100 to 99 in planOptimization for %s',
    (format) => {
      const res = planOptimization(photoClassification, {
        targetFormat: format,
        mode: 'visually-lossless',
        qualityTarget: 100,
        stripMetadata: false,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.encodeOptions.quality).toBe(99);
      }
    },
  );

  it('keeps quality: 100 in planOptimization when mode is lossless', () => {
    const res = planOptimization(photoClassification, {
      targetFormat: 'webp',
      mode: 'lossless',
      qualityTarget: 100,
      stripMetadata: false,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.encodeOptions.quality).toBe(100);
      expect(res.value.encodeOptions.lossless).toBe(true);
    }
  });

  it('clamps quality in searchAndEncode to 99 in visually-lossless mode', async () => {
    const rawImage = {
      width: 4,
      height: 4,
      data: new Uint8ClampedArray(4 * 4 * 4).fill(128),
    };
    const normalized: NormalizedImage = {
      image: rawImage,
      format: 'jpeg',
      originalByteLength: 100,
      metadata: { hasAlpha: false },
    };

    const encodeSpy = vi.spyOn(webpCodec, 'encode').mockResolvedValue(new ArrayBuffer(50));

    try {
      const planRes = planOptimization(photoClassification, {
        targetFormat: 'webp',
        mode: 'visually-lossless',
        qualityTarget: 100,
        stripMetadata: false,
      });
      expect(planRes.ok).toBe(true);
      if (!planRes.ok) return;

      const settings: UserPipelineSettings = {
        targetFormat: 'webp',
        mode: 'visually-lossless',
        qualityTarget: 100,
        stripMetadata: false,
      };

      const result = await searchAndEncode(normalized, planRes.value, settings);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.qualityParam).toBe(99);
      }
      expect(encodeSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ quality: 99 }),
      );
    } finally {
      encodeSpy.mockRestore();
    }
  });

  it('clamps quality in encodeNative to 99', async () => {
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
      return;
    }

    const dummyBuffer = new ArrayBuffer(8);
    const settings: UserPipelineSettings = {
      targetFormat: 'webp',
      mode: 'visually-lossless',
      qualityTarget: 100,
      stripMetadata: false,
    };

    const result = await encodeNative(dummyBuffer, 'jpeg', 'webp', settings);
    if (result) {
      expect(result.qualityParam).toBe(99);
    }
  });
});
