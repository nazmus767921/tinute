import { describe, it, expect } from 'vitest';
import { sniffImage } from '../sniff';

describe('Pipeline Stage 1: Sniff', () => {
  it('identifies JPEG from magic bytes (FF D8 FF)', () => {
    const jpegBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).buffer;
    const res = sniffImage(jpegBuffer);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.format).toBe('jpeg');
      expect(res.value.byteLength).toBe(6);
    }
  });

  it('identifies PNG from magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
    const pngBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).buffer;
    const res = sniffImage(pngBuffer);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.format).toBe('png');
    }
  });

  it('identifies WebP from RIFF and WEBP magic bytes', () => {
    const webpHeader = new Uint8Array(16);
    // "RIFF"
    webpHeader[0] = 0x52;
    webpHeader[1] = 0x49;
    webpHeader[2] = 0x46;
    webpHeader[3] = 0x46;
    // "WEBP" at offset 8
    webpHeader[8] = 0x57;
    webpHeader[9] = 0x45;
    webpHeader[10] = 0x42;
    webpHeader[11] = 0x50;

    const res = sniffImage(webpHeader.buffer);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.format).toBe('webp');
    }
  });

  it('returns INVALID_MAGIC_BYTES for empty buffers', () => {
    const emptyBuffer = new ArrayBuffer(0);
    const res = sniffImage(emptyBuffer);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('INVALID_MAGIC_BYTES');
    }
  });

  it('returns UNSUPPORTED_FORMAT for unknown signatures', () => {
    const garbageBuffer = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]).buffer;
    const res = sniffImage(garbageBuffer);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('UNSUPPORTED_FORMAT');
    }
  });

  it('rejects files exceeding maxFileSizeBytes limit', () => {
    const sampleBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
    const res = sniffImage(sampleBuffer, {
      maxFileSizeBytes: 2, // 2 bytes limit
      maxPixelCount: 1_000_000,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('FILE_TOO_LARGE');
    }
  });
});
