import { describe, it, expect } from 'vitest';
import { sanitizeOriginalMetadata, isAnimatedContainer } from '../metadata/privacy';
import { guardOptimization } from '../guard';
import { finalizeOptimization } from '../finalize';
import type { PipelinePlan } from '../types';

const pngChunk = (name: string, data: number[]) => {
  const chunk = new Uint8Array(data.length + 12);
  new DataView(chunk.buffer).setUint32(0, data.length);
  chunk.set(new TextEncoder().encode(name), 4);
  chunk.set(data, 8);
  return chunk;
};
const join = (...parts: Uint8Array[]) => {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output.buffer;
};
describe('privacy-safe original fallback', () => {
  it('removes JPEG EXIF, XMP, IPTC and comments while preserving image payload and ICC', () => {
    const jpeg = new Uint8Array([
      255, 216, 255, 225, 0, 4, 1, 2, 255, 237, 0, 4, 3, 4, 255, 254, 0, 4, 5, 6, 255, 226, 0, 4, 7,
      8, 255, 218, 0, 2, 10, 20, 255, 217,
    ]);
    const clean = sanitizeOriginalMetadata(jpeg.buffer, 'jpeg');
    expect(Array.from(new Uint8Array(clean!))).toEqual([
      255, 216, 255, 226, 0, 4, 7, 8, 255, 218, 0, 2, 10, 20, 255, 217,
    ]);
  });
  it('removes metadata between JPEG scans and drops data after the end marker', () => {
    const jpeg = new Uint8Array([
      255, 216, 255, 218, 0, 2, 10, 11, 255, 225, 0, 4, 1, 2, 255, 218, 0, 2, 20, 21, 255, 217, 99,
    ]);
    expect(Array.from(new Uint8Array(sanitizeOriginalMetadata(jpeg.buffer, 'jpeg')!))).toEqual([
      255, 216, 255, 218, 0, 2, 10, 11, 255, 218, 0, 2, 20, 21, 255, 217,
    ]);
  });
  it('removes PNG EXIF/text chunks and preserves pixel/ICC chunks', () => {
    const source = join(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk('IHDR', [1]),
      pngChunk('eXIf', [2]),
      pngChunk('iTXt', [3]),
      pngChunk('iCCP', [4]),
      pngChunk('IDAT', [5]),
      pngChunk('IEND', []),
    );
    const clean = new Uint8Array(sanitizeOriginalMetadata(source, 'png')!);
    const text = new TextDecoder().decode(clean);
    expect(text).not.toMatch(/eXIf|iTXt/);
    expect(text).toContain('iCCP');
    expect(text).toContain('IDAT');
  });
  it('fails closed on malformed or unsupported original containers', () => {
    expect(
      sanitizeOriginalMetadata(new Uint8Array([255, 216, 255, 225, 255, 255]).buffer, 'jpeg'),
    ).toBeNull();
    expect(sanitizeOriginalMetadata(new ArrayBuffer(20), 'heic')).toBeNull();
  });
  it('detects PNG and WebP animation before flattening', () => {
    const png = join(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk('acTL', [0, 0, 0, 2]),
    );
    expect(isAnimatedContainer(png, 'png')).toBe(true);
    const webp = new Uint8Array(30);
    webp.set(new TextEncoder().encode('RIFF'), 0);
    webp.set(new TextEncoder().encode('WEBPVP8X'), 8);
    new DataView(webp.buffer).setUint32(16, 10, true);
    webp[20] = 2;
    expect(isAnimatedContainer(webp.buffer, 'webp')).toBe(true);
  });
  it('uses sanitized fallback and reports real savings instead of returning private original bytes', () => {
    const original = new ArrayBuffer(100);
    const clean = new ArrayBuffer(80);
    const result = guardOptimization(
      original,
      { outputBuffer: new ArrayBuffer(120), format: 'webp', qualityScore: 90, durationMs: 0 },
      'png',
      { fallbackBuffer: clean },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.outputBuffer).toBe(clean);
      expect(result.value.savedBytes).toBe(20);
      expect(result.value.metadataSanitized).toBe(true);
    }
  });
  it('does not substitute an unsafe original or undo a requested resize', () => {
    const result = guardOptimization(
      new ArrayBuffer(10),
      { outputBuffer: new ArrayBuffer(20), format: 'png', qualityScore: 100, durationMs: 0 },
      'heic',
      { fallbackBuffer: null },
    );
    if (!result.ok) throw new Error('guard failed');
    expect(result.value.finalSize).toBe(20);
    expect(result.value.neverBiggerTriggered).toBe(false);
  });
  it('never fabricates metadata removal or ICC preservation from requested settings', () => {
    const guarded = guardOptimization(
      new ArrayBuffer(10),
      { outputBuffer: new ArrayBuffer(20), format: 'png', qualityScore: 100, durationMs: 0 },
      'png',
    );
    if (!guarded.ok) throw new Error('guard failed');
    const output = finalizeOptimization(
      'job',
      guarded.value,
      { mode: 'lossless', classification: 'photo' } as PipelinePlan,
      { mode: 'lossless', targetFormat: 'auto', stripMetadata: true },
      'png',
      1,
    );
    if (!output.ok) throw new Error('finalize failed');
    expect(output.value.metadataReport.exifRemoved).toBe(false);
  });
});
