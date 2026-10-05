import { describe, it, expect } from 'vitest';
import {
  computePixelHash,
  verifyBitExact,
  computePerceptualScore,
  ssimulacra2Gate,
} from '../qualityGate';
import type { RawImage } from '../../codecs/types';

function createSolidImage(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): RawImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return { data, width, height };
}

function createGradientImage(width: number, height: number): RawImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = Math.round((x / width) * 255);
      data[idx + 1] = Math.round((y / height) * 255);
      data[idx + 2] = Math.round(((x + y) / (width + height)) * 255);
      data[idx + 3] = 255;
    }
  }
  return { data, width, height };
}

describe('Quality Gate: Perceptual Metrics & Lossless Hash Verification', () => {
  describe('computePixelHash & verifyBitExact (Lossless Gate)', () => {
    it('computes deterministic 64-bit FNV-1a hash', () => {
      const img1 = createGradientImage(16, 16);
      const img2 = createGradientImage(16, 16);
      const hash1 = computePixelHash(img1);
      const hash2 = computePixelHash(img2);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{16}$/);
    });

    it('returns different hash for single-pixel discrepancy', () => {
      const img1 = createGradientImage(16, 16);
      const img2 = createGradientImage(16, 16);
      img2.data[0] = (img2.data[0]! + 1) % 256;

      const hash1 = computePixelHash(img1);
      const hash2 = computePixelHash(img2);

      expect(hash1).not.toBe(hash2);
    });

    it('verifies bit-exact pixel buffers accurately', () => {
      const img1 = createGradientImage(16, 16);
      const img2 = createGradientImage(16, 16);
      expect(verifyBitExact(img1, img2)).toBe(true);

      const modified = createGradientImage(16, 16);
      modified.data[12] = 42;
      expect(verifyBitExact(img1, modified)).toBe(false);

      const differentDim = createGradientImage(16, 8);
      expect(verifyBitExact(img1, differentDim)).toBe(false);
    });
  });

  describe('computePerceptualScore (SSIMULACRA2-Calibrated Metric)', () => {
    it('returns 100.0 for identical images', () => {
      const ref = createGradientImage(32, 32);
      const target = createGradientImage(32, 32);

      const score = computePerceptualScore(ref, target);
      expect(score).toBe(100.0);
    });

    it('returns 0 for dimension mismatches', () => {
      const ref = createGradientImage(32, 32);
      const target = createGradientImage(16, 16);

      const score = computePerceptualScore(ref, target);
      expect(score).toBe(0);
    });

    it('yields high score (>= 85.0) for subtle compression-like perturbation', () => {
      const ref = createGradientImage(32, 32);
      const target = createGradientImage(32, 32);

      // Subtle perturbation simulating high-quality compression
      for (let i = 0; i < target.data.length; i += 4) {
        target.data[i] = Math.min(255, Math.max(0, target.data[i]! + ((i % 5) - 2)));
      }

      const score = computePerceptualScore(ref, target);
      expect(score).toBeGreaterThanOrEqual(85.0);
      expect(score).toBeLessThan(100.0);
    });

    it('demonstrates score monotonicity: heavier distortion yields lower score', () => {
      const ref = createGradientImage(32, 32);
      const slightDistortion = createGradientImage(32, 32);
      const heavyDistortion = createGradientImage(32, 32);

      for (let i = 0; i < slightDistortion.data.length; i += 4) {
        slightDistortion.data[i] = Math.min(255, Math.max(0, slightDistortion.data[i]! + 5));
      }

      for (let i = 0; i < heavyDistortion.data.length; i += 4) {
        heavyDistortion.data[i] = Math.min(255, Math.max(0, heavyDistortion.data[i]! + 50));
      }

      const slightScore = computePerceptualScore(ref, slightDistortion);
      const heavyScore = computePerceptualScore(ref, heavyDistortion);

      expect(slightScore).toBeGreaterThan(heavyScore);
    });

    it('penalizes chroma distortion', () => {
      const ref = createSolidImage(16, 16, 128, 128, 128);
      const colorShifted = createSolidImage(16, 16, 200, 50, 128);

      const score = computePerceptualScore(ref, colorShifted);
      expect(score).toBeLessThan(70.0);
    });

    it('ssimulacra2Gate instance adheres to QualityMetricGate contract', () => {
      expect(ssimulacra2Gate.name).toBe('SSIMULACRA2-Calibrated');
      const ref = createGradientImage(16, 16);
      expect(ssimulacra2Gate.computePerceptualScore(ref, ref)).toBe(100.0);
      expect(ssimulacra2Gate.verifyBitExact(ref, ref)).toBe(true);
      expect(typeof ssimulacra2Gate.computePixelHash(ref)).toBe('string');
    });
  });
});
