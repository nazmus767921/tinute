import { describe, it, expect } from 'vitest';
import { executePipeline } from '../execute';
import { pngCodec } from '../../codecs/pngCodec';

describe('End-to-End Pipeline Execution', () => {
  it('processes a PNG image through all 8 pipeline stages and compresses to WebP', async () => {
    // Generate valid 32x32 gradient PNG input buffer
    const width = 32;
    const height = 32;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = (i * 7) % 255;
      data[i + 1] = (i * 13) % 255;
      data[i + 2] = (i * 29) % 255;
      data[i + 3] = 255;
    }
    const inputBuffer = await pngCodec.encode({ data, width, height });

    const res = await executePipeline('job-1', inputBuffer, {
      targetFormat: 'webp',
      mode: 'visually-lossless',
      stripMetadata: true,
      qualityTarget: 60,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.originalFormat).toBe('png');
      expect(res.value.originalSize).toBe(inputBuffer.byteLength);
      expect(res.value.outputBuffer.byteLength).toBeGreaterThan(0);
      expect(res.value.metadataReport.gpsRemoved).toBe(true);
      expect(res.value.durationMs).toBeGreaterThanOrEqual(0);
      expect(res.value.qualityScore).toBeGreaterThanOrEqual(60);
      expect(res.value.qualityScore).toBeLessThanOrEqual(100);

      // Either compressed successfully or guarded by never-bigger
      if (!res.value.neverBiggerTriggered) {
        expect(res.value.outputFormat).toBe('webp');
        expect(res.value.finalSize).toBeLessThan(res.value.originalSize);
      }
    }
  });

  it('executes lossless mode with bit-exact hash verification and score 100', async () => {
    const width = 16;
    const height = 16;
    const data = new Uint8ClampedArray(width * height * 4).fill(200);
    const inputBuffer = await pngCodec.encode({ data, width, height });

    const res = await executePipeline('job-lossless', inputBuffer, {
      targetFormat: 'png',
      mode: 'lossless',
      stripMetadata: true,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.mode).toBe('lossless');
      expect(res.value.qualityScore).toBe(100.0);
      expect(res.value.isLosslessBitExact).toBe(true);
    }
  });

  it('triggers decompression bomb defense when pixel limit is exceeded', async () => {
    // 8x8 image = 64 pixels
    const pattern = {
      data: new Uint8ClampedArray(8 * 8 * 4).fill(120),
      width: 8,
      height: 8,
    };
    const inputBuffer = await pngCodec.encode(pattern);

    const res = await executePipeline('job-bomb', inputBuffer, {
      targetFormat: 'auto',
      mode: 'visually-lossless',
      stripMetadata: true,
      limits: {
        maxPixelCount: 20, // 20 pixels limit < 64 pixels image
      },
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('DECOMPRESSION_BOMB_LIMIT_EXCEEDED');
      expect(res.error.message).toContain('exceed maximum safety limit');
    }
  });
});
