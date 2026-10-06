import { describe, it, expect, vi } from 'vitest';
import { executePipeline } from '../execute';
import { planOptimization } from '../plan';
import { pngCodec, jpegCodec, webpCodec } from '../../codecs';
import { searchAndEncode } from '../search';
import { extractExif } from '../metadata/exif';
import { sanitizeOriginalMetadata } from '../metadata/privacy';
import { estimateJobMemory } from '../../workers/inspect';
import { PROCESSING_BUDGET_BYTES } from '../../workers/admission';

const classification = {
  classification: 'photo' as const,
  hasAlpha: false,
  edgeDensity: 0,
  uniqueColorCountEstimate: 1000,
};
const settings = {
  targetFormat: 'preserve' as const,
  mode: 'visually-lossless' as const,
  stripMetadata: true,
  qualityTarget: 80,
};
describe('bounded preserve-format processing', () => {
  it('reserves the full transform budget for PNG resizing and rejects before decode', async () => {
    const bytes = new Uint8Array(33);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 7372);
    view.setUint32(20, 4392);
    bytes[24] = 8;
    bytes[25] = 6;
    const file = {
      size: bytes.length,
      slice: () => ({ arrayBuffer: async () => bytes.buffer }),
    } as unknown as File;
    expect(await estimateJobMemory(file, settings)).toBeLessThan(PROCESSING_BUDGET_BYTES);
    const resized = { ...settings, maxDimension: 1600 };
    expect(await estimateJobMemory(file, resized)).toBeGreaterThan(PROCESSING_BUDGET_BYTES);
    const decode = vi.spyOn(pngCodec, 'decode');
    try {
      const result = await executePipeline('png-resize-budget', bytes.buffer, resized);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('DECOMPRESSION_BOMB_LIMIT_EXCEEDED');
      expect(decode).not.toHaveBeenCalled();
    } finally {
      decode.mockRestore();
    }
  });
  it('rejects a large pixel fallback when the native encoder is unavailable', async () => {
    const source = new Uint8Array([
      255, 216, 255, 192, 0, 17, 8, 17, 40, 28, 204, 3, 1, 17, 0, 2, 17, 0, 3, 17, 0, 255, 217,
    ]);
    vi.stubGlobal('OffscreenCanvas', class {});
    vi.stubGlobal('createImageBitmap', undefined);
    const decode = vi.spyOn(jpegCodec, 'decode');
    try {
      const result = await executePipeline('large-fallback', source.buffer, settings);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('DECOMPRESSION_BOMB_LIMIT_EXCEEDED');
      expect(decode).not.toHaveBeenCalled();
    } finally {
      decode.mockRestore();
      vi.unstubAllGlobals();
    }
  });
  it('removes private JPEG metadata without losing display orientation', () => {
    const source = new Uint8Array([
      255, 216, 255, 225, 0, 34, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3,
      0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 255, 217,
    ]);
    const clean = sanitizeOriginalMetadata(source.buffer, 'jpeg');
    expect(clean).not.toBeNull();
    expect(extractExif(clean!).orientation).toBe(6);
    expect(extractExif(clean!).hasGps).toBe(false);
  });
  it.each(['jpeg', 'png', 'webp'] as const)(
    'resolves %s from source rather than content',
    (format) => {
      const result = planOptimization(classification, settings, format);
      expect(result.ok && result.value.targetFormat).toBe(format);
    },
  );
  it('optimizes an existing PNG without decoding pixels', async () => {
    const raw = { width: 8, height: 8, data: new Uint8ClampedArray(256).fill(255) };
    const input = await pngCodec.encode(raw);
    const decode = vi.spyOn(pngCodec, 'decode');
    try {
      const result = await executePipeline('png', input, settings);
      expect(result.ok && result.value.outputFormat).toBe('png');
      expect(decode).not.toHaveBeenCalled();
    } finally {
      decode.mockRestore();
    }
  });
  it('retains JPEG pixels in lossless preserve mode', async () => {
    const input = await jpegCodec.encode({
      width: 8,
      height: 8,
      data: new Uint8ClampedArray(256).fill(255),
    });
    const encode = vi.spyOn(jpegCodec, 'encode');
    try {
      const result = await executePipeline('jpeg', input, { ...settings, mode: 'lossless' });
      expect(result.ok && result.value.isLosslessBitExact).toBe(true);
      expect(encode).not.toHaveBeenCalled();
    } finally {
      encode.mockRestore();
    }
  });
  it('honors larger explicit conversion results', async () => {
    const input = await jpegCodec.encode({
      width: 8,
      height: 8,
      data: new Uint8ClampedArray(256).fill(255),
    });
    const encode = vi
      .spyOn(pngCodec, 'encode')
      .mockResolvedValue(new ArrayBuffer(input.byteLength + 1000));
    const decode = vi.spyOn(pngCodec, 'decode').mockResolvedValue(await jpegCodec.decode(input));
    try {
      const result = await executePipeline('convert', input, {
        ...settings,
        targetFormat: 'png',
        stripMetadata: false,
      });
      expect(result.ok && result.value.outputFormat).toBe('png');
    } finally {
      encode.mockRestore();
      decode.mockRestore();
    }
  });
  it('encodes lossy output once without a full output decode', async () => {
    const raw = { width: 640, height: 640, data: new Uint8ClampedArray(640 * 640 * 4).fill(255) };
    const encode = vi.spyOn(webpCodec, 'encode').mockResolvedValue(new ArrayBuffer(10));
    const decode = vi.spyOn(webpCodec, 'decode');
    try {
      const result = await searchAndEncode(
        { image: raw, format: 'png', originalByteLength: 10, metadata: { hasAlpha: false } },
        {
          targetFormat: 'webp',
          mode: 'visually-lossless',
          encodeOptions: { quality: 80 },
          classification: 'photo',
          candidateEncoders: ['webp'],
        },
        settings,
      );
      expect(result.ok).toBe(true);
      expect(encode).toHaveBeenCalledTimes(1);
      expect(decode).not.toHaveBeenCalled();
    } finally {
      encode.mockRestore();
      decode.mockRestore();
    }
  });
});
