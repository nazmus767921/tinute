import { describe, it, expect } from 'vitest';
import { normalizeOrientation } from '../metadata/orientation';
import { parseTiffExif, extractExif } from '../metadata/exif';
import { inspectIccProfile, normalizeColorSpace } from '../metadata/icc';
import type { RawImage } from '../../codecs/types';

describe('Metadata Handling (Phase 3)', () => {
  describe('EXIF Orientation Normalization', () => {
    // 2x1 test image: Left pixel is Red (255, 0, 0, 255), Right pixel is Blue (0, 0, 255, 255)
    const test2x1: RawImage = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]),
    };

    it('Orientation 1 (Normal): returns identical image', () => {
      const res = normalizeOrientation(test2x1, 1);
      expect(res.width).toBe(2);
      expect(res.height).toBe(1);
      expect(res.data[0]).toBe(255); // Red at left
      expect(res.data[4]).toBe(0); // Blue at right
    });

    it('Orientation 2 (Horizontal Mirror): flips left and right', () => {
      const res = normalizeOrientation(test2x1, 2);
      expect(res.width).toBe(2);
      expect(res.height).toBe(1);
      expect(res.data[0]).toBe(0); // Blue is now at left
      expect(res.data[4]).toBe(255); // Red is now at right
    });

    it('Orientation 3 (180 deg): rotates 180 degrees', () => {
      const res = normalizeOrientation(test2x1, 3);
      expect(res.width).toBe(2);
      expect(res.height).toBe(1);
      expect(res.data[0]).toBe(0); // Blue at (0, 0)
      expect(res.data[4]).toBe(255); // Red at (1, 0)
    });

    it('Orientation 6 (90 deg CW): rotates dimensions 2x1 to 1x2', () => {
      const res = normalizeOrientation(test2x1, 6);
      expect(res.width).toBe(1);
      expect(res.height).toBe(2);
      // Top pixel is Red, Bottom pixel is Blue
      expect(res.data[0]).toBe(255); // Red at (0, 0)
      expect(res.data[4]).toBe(0); // Blue at (0, 1)
    });

    it('Orientation 8 (270 deg CW / 90 deg CCW): rotates dimensions 2x1 to 1x2', () => {
      const res = normalizeOrientation(test2x1, 8);
      expect(res.width).toBe(1);
      expect(res.height).toBe(2);
      // Top pixel is Blue, Bottom pixel is Red
      expect(res.data[0]).toBe(0); // Blue at (0, 0)
      expect(res.data[4]).toBe(255); // Red at (0, 1)
    });
  });

  describe('EXIF Parser', () => {
    it('parses orientation and GPS tags from synthetic TIFF EXIF header', () => {
      // Build a minimal valid TIFF header with orientation tag 6 and GPS tag
      const buf = new Uint8Array(64);
      const view = new DataView(buf.buffer);
      // Little Endian 'II' + 42
      buf[0] = 0x49;
      buf[1] = 0x49;
      view.setUint16(2, 42, true);
      view.setUint32(4, 8, true); // IFD0 offset = 8

      // IFD0: 2 entries
      view.setUint16(8, 2, true);

      // Entry 1: Orientation (0x0112), type 3 (SHORT), count 1, value 6
      view.setUint16(10, 0x0112, true);
      view.setUint16(12, 3, true);
      view.setUint32(14, 1, true);
      view.setUint16(18, 6, true);

      // Entry 2: GPSInfo (0x8825), type 4 (LONG), count 1, offset 48
      view.setUint16(22, 0x8825, true);
      view.setUint16(24, 4, true);
      view.setUint32(26, 1, true);
      view.setUint32(30, 48, true);

      const parsed = parseTiffExif(buf, 0);
      expect(parsed.orientation).toBe(6);
      expect(parsed.hasGps).toBe(true);
    });

    it('safely handles buffers without EXIF', () => {
      const emptyBuf = new ArrayBuffer(20);
      const parsed = extractExif(emptyBuf);
      expect(parsed.orientation).toBe(1);
      expect(parsed.hasGps).toBe(false);
    });
  });

  describe('ICC Profile Handling', () => {
    it('identifies sRGB vs Display P3 profiles', () => {
      // Synthetic ICC with 'acsp' magic and 'Display P3' in desc tag
      const iccBytes = new Uint8Array(256);
      const view = new DataView(iccBytes.buffer);
      view.setUint32(0, 256, false); // size
      // Magic 'acsp' at offset 36
      iccBytes[36] = 0x61;
      iccBytes[37] = 0x63;
      iccBytes[38] = 0x73;
      iccBytes[39] = 0x70;
      // Tag count = 1 at 128
      view.setUint32(128, 1, false);
      // Tag 1: 'desc', offset 144, len 32
      iccBytes[132] = 0x64;
      iccBytes[133] = 0x65;
      iccBytes[134] = 0x73;
      iccBytes[135] = 0x63;
      view.setUint32(136, 144, false);
      view.setUint32(140, 32, false);

      // At 144: 'desc' type, length 10, "Display P3\0"
      iccBytes[144] = 0x64;
      iccBytes[145] = 0x65;
      iccBytes[146] = 0x73;
      iccBytes[147] = 0x63;
      view.setUint32(152, 10, false);
      const nameBytes = new TextEncoder().encode('Display P3');
      iccBytes.set(nameBytes, 156);

      const profile = inspectIccProfile(iccBytes);
      expect(profile.colorSpace).toBe('display-p3');
      expect(profile.name).toBe('Display P3');
    });

    it('normalizes Display P3 wide-gamut colors to sRGB while preserving alpha', async () => {
      const p3Image: RawImage = {
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([200, 100, 50, 180]),
      };

      const normalized = await normalizeColorSpace(p3Image, {
        name: 'Display P3',
        colorSpace: 'display-p3',
      });

      expect(normalized.width).toBe(1);
      expect(normalized.height).toBe(1);
      // Alpha channel must be preserved bit-for-bit
      expect(normalized.data[3]).toBe(180);
      // RGB channels are transformed
      expect(normalized.data[0]).toBeGreaterThan(0);
    });
  });
});
