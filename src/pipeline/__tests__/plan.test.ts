import { describe, it, expect } from 'vitest';
import { planOptimization } from '../plan';
import type { ClassificationResult } from '../types';

describe('Pipeline Stage 5: Plan', () => {
  const photoClassification: ClassificationResult = {
    classification: 'photo',
    uniqueColorCountEstimate: 15000,
    edgeDensity: 12,
    hasAlpha: false,
  };

  const alphaIllustrationClassification: ClassificationResult = {
    classification: 'illustration',
    uniqueColorCountEstimate: 200,
    edgeDensity: 8,
    hasAlpha: true,
  };

  it('selects WebP for transparent images in Auto mode', () => {
    const res = planOptimization(alphaIllustrationClassification, {
      targetFormat: 'auto',
      mode: 'visually-lossless',
      stripMetadata: true,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.targetFormat).toBe('webp');
    }
  });

  it('selects PNG with OxiPNG optimization when mode is lossless for line-art', () => {
    const lineArtClassification: ClassificationResult = {
      classification: 'line-art',
      uniqueColorCountEstimate: 16,
      edgeDensity: 5,
      hasAlpha: false,
    };

    const res = planOptimization(lineArtClassification, {
      targetFormat: 'auto',
      mode: 'lossless',
      stripMetadata: true,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.targetFormat).toBe('png');
      expect(res.value.encodeOptions).toMatchObject({ level: 2 });
    }
  });

  it('honors explicit user target format overrides', () => {
    const res = planOptimization(photoClassification, {
      targetFormat: 'jpeg',
      mode: 'visually-lossless',
      qualityTarget: 85,
      stripMetadata: true,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.targetFormat).toBe('jpeg');
      expect(res.value.encodeOptions).toMatchObject({ quality: 85 });
    }
  });
});
