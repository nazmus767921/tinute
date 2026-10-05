import { describe, it, expect } from 'vitest';
import { sniffImage } from '../sniff';
import { planOptimization } from '../plan';
import { executePipeline } from '../execute';
import { bmpCodec } from '../../codecs/bmpCodec';
import { tiffCodec } from '../../codecs/tiffCodec';
import { gifCodec } from '../../codecs/gifCodec';
import type { RawImage } from '../../codecs/types';

describe('Tier 1 Pipeline Integration (Phase 3)', () => {
  const sample4x4: RawImage = {
    width: 4,
    height: 4,
    data: new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255, 255, 0, 255, 255, 0, 255,
      255, 255, 128, 128, 128, 255, 0, 0, 0, 255, 255, 255, 255, 255, 64, 64, 64, 255, 192, 192,
      192, 255, 255, 128, 0, 255, 0, 128, 255, 255, 128, 0, 255, 255, 255, 0, 128, 255, 0, 255, 128,
      255,
    ]),
  };

  describe('Magic Bytes Sniffer for All Tier 1 Formats', () => {
    it('detects BMP magic bytes', async () => {
      const bmpBuf = await bmpCodec.encode(sample4x4);
      const res = sniffImage(bmpBuf);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.format).toBe('bmp');
    });

    it('detects TIFF magic bytes', async () => {
      const tiffBuf = await tiffCodec.encode(sample4x4);
      const res = sniffImage(tiffBuf);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.format).toBe('tiff');
    });

    it('detects GIF magic bytes', async () => {
      const gifBuf = await gifCodec.encode(sample4x4);
      const res = sniffImage(gifBuf);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.format).toBe('gif');
    });

    it('detects SVG text header', () => {
      const svgBuf = new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      ).buffer;
      const res = sniffImage(svgBuf);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.format).toBe('svg');
    });

    it('detects JXL codestream header', () => {
      const jxlBuf = new Uint8Array([0xff, 0x0a, 0x00, 0x00]).buffer;
      const res = sniffImage(jxlBuf);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.format).toBe('jxl');
    });

    it('detects AVIF ISOBMFF ftyp header', () => {
      const avifHeader = new Uint8Array([
        0,
        0,
        0,
        28,
        0x66,
        0x74,
        0x79,
        0x70, // 'ftyp'
        0x61,
        0x76,
        0x69,
        0x66, // 'avif'
        0,
        0,
        0,
        0,
        0x6d,
        0x69,
        0x66,
        0x31,
      ]).buffer;
      const res = sniffImage(avifHeader);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.format).toBe('avif');
    });

    it('detects HEIC ISOBMFF ftyp header', () => {
      const heicHeader = new Uint8Array([
        0,
        0,
        0,
        28,
        0x66,
        0x74,
        0x79,
        0x70, // 'ftyp'
        0x68,
        0x65,
        0x69,
        0x63, // 'heic'
        0,
        0,
        0,
        0,
        0x6d,
        0x69,
        0x66,
        0x31,
      ]).buffer;
      const res = sniffImage(heicHeader);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.format).toBe('heic');
    });
  });

  describe('Planner with Extended Tier 1 Target Formats', () => {
    it('plans auto WebP for images with alpha', () => {
      const planRes = planOptimization(
        {
          classification: 'photo',
          uniqueColorCountEstimate: 1000,
          edgeDensity: 0.1,
          hasAlpha: true,
        },
        { targetFormat: 'auto', mode: 'visually-lossless', stripMetadata: true },
      );
      expect(planRes.ok).toBe(true);
      if (planRes.ok) {
        expect(planRes.value.targetFormat).toBe('webp');
      }
    });

    it('plans explicit AVIF format when requested by user', () => {
      const planRes = planOptimization(
        {
          classification: 'photo',
          uniqueColorCountEstimate: 1000,
          edgeDensity: 0.1,
          hasAlpha: false,
        },
        { targetFormat: 'avif', mode: 'visually-lossless', stripMetadata: true },
      );
      expect(planRes.ok).toBe(true);
      if (planRes.ok) {
        expect(planRes.value.targetFormat).toBe('avif');
      }
    });
  });

  describe('End-to-End Execution with Tier 1 Formats', () => {
    it('processes BMP image and compresses to WebP', async () => {
      const bmp32: RawImage = {
        width: 32,
        height: 32,
        data: new Uint8ClampedArray(32 * 32 * 4).fill(128),
      };
      const bmpBuf = await bmpCodec.encode(bmp32);
      const res = await executePipeline('job-bmp-1', bmpBuf, {
        targetFormat: 'webp',
        mode: 'visually-lossless',
        stripMetadata: true,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.originalFormat).toBe('bmp');
        expect(res.value.outputFormat).toBe('webp');
        expect(res.value.finalSize).toBeLessThan(res.value.originalSize);
        expect(res.value.neverBiggerTriggered).toBe(false);
        expect(res.value.qualityScore).toBeGreaterThanOrEqual(0);
      }
    });

    it('processes vector SVG image and rasterizes to PNG', async () => {
      const svgMarkup =
        '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="blue"/></svg>';
      const svgBuf = new TextEncoder().encode(svgMarkup).buffer;
      const res = await executePipeline('job-svg-1', svgBuf, {
        targetFormat: 'png',
        mode: 'lossless',
        stripMetadata: true,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.originalFormat).toBe('svg');
        expect(res.value.outputFormat).toBe('png');
        expect(res.value.finalSize).toBeGreaterThan(0);
        expect(res.value.isLosslessBitExact).toBe(true);
      }
    });
  });
});
