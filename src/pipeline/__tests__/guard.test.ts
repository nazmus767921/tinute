import { describe, it, expect } from 'vitest';
import { guardOptimization } from '../guard';
import type { EncodeResult } from '../types';

describe('Pipeline Stage 7: Guard (Never-Bigger Rule & Safety)', () => {
  it('enforces Never-Bigger Rule: reverts to original when encoded size exceeds original', () => {
    const originalBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).buffer; // 10 bytes
    const biggerEncoded: EncodeResult = {
      outputBuffer: new Uint8Array(15).buffer, // 15 bytes
      format: 'webp',
      qualityScore: 82.5,
      isLosslessBitExact: false,
      durationMs: 40,
    };

    const res = guardOptimization(originalBuffer, biggerEncoded, 'png', 'visually-lossless');
    expect(res.ok).toBe(true);

    if (res.ok) {
      expect(res.value.neverBiggerTriggered).toBe(true);
      expect(res.value.finalSize).toBe(10);
      expect(res.value.savedBytes).toBe(0);
      expect(res.value.savingsPercentage).toBe(0);
      expect(res.value.outputBuffer).toBe(originalBuffer);
      expect(res.value.format).toBe('png'); // Preserves original format
      expect(res.value.qualityScore).toBe(100.0); // Preserved original retains 100% fidelity
      expect(res.value.isLosslessBitExact).toBe(true);
    }
  });

  it('enforces Never-Bigger Rule: reverts when encoded size is exactly equal to original', () => {
    const originalBuffer = new Uint8Array(100).buffer;
    const equalEncoded: EncodeResult = {
      outputBuffer: new Uint8Array(100).buffer,
      format: 'jpeg',
      qualityScore: 88.0,
      durationMs: 50,
    };

    const res = guardOptimization(originalBuffer, equalEncoded, 'jpeg', 'visually-lossless');
    expect(res.ok).toBe(true);

    if (res.ok) {
      expect(res.value.neverBiggerTriggered).toBe(true);
      expect(res.value.savedBytes).toBe(0);
      expect(res.value.qualityScore).toBe(100.0);
      expect(res.value.isLosslessBitExact).toBe(true);
    }
  });

  it('accepts smaller output and calculates exact savings percentage and preserves quality score', () => {
    const originalBuffer = new Uint8Array(1000).buffer; // 1000 bytes
    const smallerEncoded: EncodeResult = {
      outputBuffer: new Uint8Array(400).buffer, // 400 bytes (60% saved)
      format: 'webp',
      qualityScore: 91.4,
      isLosslessBitExact: false,
      durationMs: 80,
    };

    const res = guardOptimization(originalBuffer, smallerEncoded, 'jpeg', 'visually-lossless');
    expect(res.ok).toBe(true);

    if (res.ok) {
      expect(res.value.neverBiggerTriggered).toBe(false);
      expect(res.value.finalSize).toBe(400);
      expect(res.value.savedBytes).toBe(600);
      expect(res.value.savingsPercentage).toBe(60);
      expect(res.value.qualityScore).toBe(91.4);
      expect(res.value.isLosslessBitExact).toBe(false);
    }
  });

  it('flags generational loss warning when converting lossy JPEG to lossy WebP', () => {
    const originalBuffer = new Uint8Array(500).buffer;
    const encoded: EncodeResult = {
      outputBuffer: new Uint8Array(300).buffer,
      format: 'webp',
      qualityScore: 84.0,
      durationMs: 60,
    };

    const res = guardOptimization(originalBuffer, encoded, 'jpeg', 'visually-lossless');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.generationalLossWarning).toBe(true);
    }
  });

  it('does NOT flag generational loss warning when compressing lossless PNG', () => {
    const originalBuffer = new Uint8Array(500).buffer;
    const encoded: EncodeResult = {
      outputBuffer: new Uint8Array(300).buffer,
      format: 'webp',
      qualityScore: 93.0,
      durationMs: 60,
    };

    const res = guardOptimization(originalBuffer, encoded, 'png', 'visually-lossless');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.generationalLossWarning).toBe(false);
    }
  });
});
