import type { ImageFormat } from '../types';
import { gifCodec } from '../../codecs/gifCodec';
import { extractExif } from './exif';

/** Retain only display orientation, with no camera, location, or identity fields. */
function orientationSegment(orientation: number): Uint8Array {
  const segment = new Uint8Array(36);
  segment.set([
    255,
    225,
    0,
    34,
    69,
    120,
    105,
    102,
    0,
    0,
    73,
    73,
    42,
    0,
    8,
    0,
    0,
    0,
    1,
    0,
    18,
    1,
    3,
    0,
    1,
    0,
    0,
    0,
    orientation,
    0,
  ]);
  return segment;
}

const nameAt = (bytes: Uint8Array, offset: number) =>
  String.fromCharCode(...bytes.subarray(offset, offset + 4));
const combine = (parts: Uint8Array[]) => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result.buffer;
};

/** Fail closed: only retain original containers whose metadata can be safely removed. */
export function sanitizeOriginalMetadata(
  buffer: ArrayBuffer,
  format: ImageFormat,
): ArrayBuffer | null {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  try {
    if (format === 'jpeg') {
      if (bytes[0] !== 255 || bytes[1] !== 216) return null;
      const parts = [bytes.subarray(0, 2)];
      const orientation = extractExif(buffer).orientation;
      if (orientation > 1) parts.push(orientationSegment(orientation));
      let offset = 2;
      while (offset < bytes.length) {
        const start = offset;
        if (bytes[offset++] !== 255) return null;
        while (bytes[offset] === 255) offset++;
        const marker = bytes[offset++];
        if (marker === undefined) return null;
        if (marker === 0xd9) {
          parts.push(bytes.subarray(start, offset));
          return combine(parts);
        }
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          parts.push(bytes.subarray(start, offset));
          continue;
        }
        const length = view.getUint16(offset);
        if (length < 2 || offset + length > bytes.length) return null;
        // APP2 contains ICC; APP0 contains JFIF. Other APP segments/comments may identify the owner.
        if (!(marker === 0xfe || (marker >= 0xe1 && marker <= 0xef && marker !== 0xe2))) {
          parts.push(bytes.subarray(start, offset + length));
        }
        offset += length;
        if (marker === 0xda) {
          const entropyStart = offset;
          while (offset < bytes.length) {
            if (bytes[offset] !== 255) {
              offset++;
              continue;
            }
            const next = bytes[offset + 1];
            if (next === 0 || (next !== undefined && next >= 0xd0 && next <= 0xd7)) {
              offset += 2;
              continue;
            }
            break;
          }
          parts.push(bytes.subarray(entropyStart, offset));
        }
      }
      return null;
    }
    if (format === 'png') {
      if (bytes.length < 8 || nameAt(bytes, 1) !== 'PNG\r') return null;
      const parts = [bytes.subarray(0, 8)];
      // Keep only pixel, color, transparency, and display information. Copy existing CRCs verbatim.
      const allowed = new Set([
        'IHDR',
        'PLTE',
        'IDAT',
        'IEND',
        'tRNS',
        'cHRM',
        'gAMA',
        'iCCP',
        'sRGB',
        'sBIT',
        'bKGD',
        'pHYs',
        'cICP',
        'mDCV',
        'cLLI',
      ]);
      let offset = 8;
      while (offset + 12 <= bytes.length) {
        const size = view.getUint32(offset);
        const end = offset + 12 + size;
        if (end > bytes.length) return null;
        const type = nameAt(bytes, offset + 4);
        if (allowed.has(type)) parts.push(bytes.subarray(offset, end));
        else if ((bytes[offset + 4]! & 32) === 0) return null; // Unknown critical chunk.
        offset = end;
        if (type === 'IEND') return combine(parts);
      }
      return null;
    }
    if (format === 'webp') {
      if (
        bytes.length < 12 ||
        nameAt(bytes, 0) !== 'RIFF' ||
        nameAt(bytes, 8) !== 'WEBP' ||
        view.getUint32(4, true) + 8 !== bytes.length
      )
        return null;
      const parts = [bytes.slice(0, 12)];
      const allowed = new Set(['VP8X', 'ICCP', 'ALPH', 'VP8 ', 'VP8L']);
      let offset = 12;
      while (offset + 8 <= bytes.length) {
        const size = view.getUint32(offset + 4, true);
        const end = offset + 8 + size + (size % 2);
        if (end > bytes.length) return null;
        const type = nameAt(bytes, offset);
        if (type === 'ANIM' || type === 'ANMF') return null;
        if (allowed.has(type)) {
          const chunk = bytes.slice(offset, end);
          if (type === 'VP8X') {
            if (size !== 10 || chunk[8]! & 2) return null;
            chunk[8] = chunk[8]! & ~0x0c; // EXIF and XMP feature flags.
          }
          parts.push(chunk);
        }
        offset = end;
      }
      if (offset !== bytes.length) return null;
      const result = combine(parts);
      new DataView(result).setUint32(4, result.byteLength - 8, true);
      return result;
    }
  } catch {
    return null;
  }
  return null;
}

/** Detect animation before passing still-image codecs a multi-frame source. */
export function isAnimatedContainer(buffer: ArrayBuffer, format: ImageFormat): boolean {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  try {
    if (format === 'gif') return gifCodec.inspectGif(buffer).frameCount > 1;
    if (format === 'png') {
      let offset = 8;
      while (offset + 12 <= bytes.length) {
        const size = view.getUint32(offset);
        if (offset + 12 + size > bytes.length) break;
        if (nameAt(bytes, offset + 4) === 'acTL') return true;
        offset += 12 + size;
      }
    }
    if (format === 'webp') {
      let offset = 12;
      while (offset + 8 <= bytes.length) {
        const size = view.getUint32(offset + 4, true);
        const name = nameAt(bytes, offset);
        if (
          name === 'ANIM' ||
          name === 'ANMF' ||
          (name === 'VP8X' && size >= 1 && bytes[offset + 8]! & 2)
        )
          return true;
        offset += 8 + size + (size % 2);
      }
    }
    if (format === 'avif' || format === 'heic') {
      if (nameAt(bytes, 4) === 'ftyp') {
        const end = Math.min(view.getUint32(0), bytes.length);
        for (let offset = 8; offset + 4 <= end; offset += 4) {
          if (['avis', 'msf1', 'hevc', 'hevx'].includes(nameAt(bytes, offset))) return true;
        }
      }
    }
  } catch {
    /* Decode stage reports malformed containers. */
  }
  return false;
}
