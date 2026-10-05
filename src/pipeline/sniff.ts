import {
  ok,
  err,
  type Result,
  type SniffResult,
  type PipelineError,
  type PipelineLimits,
  DEFAULT_PIPELINE_LIMITS,
} from './types';

/**
 * Sniffs image format from magic bytes and enforces file size limits.
 * Pure function: Does NOT rely on filename extension.
 * Supports all Tier 1 formats: JPEG, PNG, WebP, AVIF, JXL, GIF, HEIC/HEIF, TIFF, BMP, SVG.
 */
export function sniffImage(
  buffer: ArrayBuffer,
  limits: PipelineLimits = DEFAULT_PIPELINE_LIMITS,
): Result<SniffResult, PipelineError> {
  const byteLength = buffer.byteLength;

  if (byteLength === 0) {
    return err({
      code: 'INVALID_MAGIC_BYTES',
      message: 'Image buffer is empty (0 bytes).',
    });
  }

  if (byteLength > limits.maxFileSizeBytes) {
    const maxMb = (limits.maxFileSizeBytes / (1024 * 1024)).toFixed(1);
    const actualMb = (byteLength / (1024 * 1024)).toFixed(1);
    return err({
      code: 'FILE_TOO_LARGE',
      message: `File size (${actualMb} MB) exceeds maximum allowed limit of ${maxMb} MB.`,
    });
  }

  const bytes = new Uint8Array(buffer, 0, Math.min(64, byteLength));

  // 1. JPEG Magic Bytes: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return ok({ format: 'jpeg', byteLength });
  }

  // 2. PNG Magic Bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 && // P
    bytes[2] === 0x4e && // N
    bytes[3] === 0x47 && // G
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return ok({ format: 'png', byteLength });
  }

  // 3. WebP Magic Bytes: RIFF .... WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return ok({ format: 'webp', byteLength });
  }

  // 4. GIF Magic Bytes: "GIF87a" (47 49 46 38 37 61) or "GIF89a" (47 49 46 38 39 61)
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 && // G
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x38 && // 8
    (bytes[4] === 0x37 || bytes[4] === 0x39) && // 7 or 9
    bytes[5] === 0x61 // a
  ) {
    return ok({ format: 'gif', byteLength });
  }

  // 5. BMP Magic Bytes: "BM" (42 4D)
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return ok({ format: 'bmp', byteLength });
  }

  // 6. TIFF Magic Bytes: Little Endian "II*\0" (49 49 2A 00) or Big Endian "MM\0*" (4D 4D 00 2A)
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    return ok({ format: 'tiff', byteLength });
  }

  // 7. JPEG XL (JXL):
  // Naked codestream: FF 0A
  // ISOBMFF container box: 00 00 00 0C 4A 58 4C 20 0D 0A 87 0A
  if (
    (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0x0a) ||
    (bytes.length >= 12 &&
      bytes[0] === 0x00 &&
      bytes[1] === 0x00 &&
      bytes[2] === 0x00 &&
      bytes[3] === 0x0c &&
      bytes[4] === 0x4a && // J
      bytes[5] === 0x58 && // X
      bytes[6] === 0x4c && // L
      bytes[7] === 0x20 && // ' '
      bytes[8] === 0x0d &&
      bytes[9] === 0x0a &&
      bytes[10] === 0x87 &&
      bytes[11] === 0x0a)
  ) {
    return ok({ format: 'jxl', byteLength });
  }

  // 8. ISOBMFF Containers: AVIF vs HEIC/HEIF
  // Offset 4-7: "ftyp" (66 74 79 70)
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 && // f
    bytes[5] === 0x74 && // t
    bytes[6] === 0x79 && // y
    bytes[7] === 0x70 // p
  ) {
    // Read major brand (bytes 8-11) and compatible brands (up to byte 32)
    const brandStr = String.fromCharCode(...bytes.subarray(8, Math.min(32, bytes.length)));
    if (brandStr.includes('avif') || brandStr.includes('avis')) {
      return ok({ format: 'avif', byteLength });
    }
    if (
      brandStr.includes('heic') ||
      brandStr.includes('heix') ||
      brandStr.includes('hevc') ||
      brandStr.includes('hevx') ||
      brandStr.includes('mif1') ||
      brandStr.includes('msf1')
    ) {
      return ok({ format: 'heic', byteLength });
    }
  }

  // 9. SVG: text scanning
  // Starts with optional whitespace / BOM, then '<svg' or '<?xml'
  const textSample = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, Math.min(64, bytes.length)))
    .trimStart();

  if (
    textSample.startsWith('<svg') ||
    textSample.startsWith('<?xml') ||
    textSample.startsWith('<!DOCTYPE svg')
  ) {
    return ok({ format: 'svg', byteLength });
  }

  return err({
    code: 'UNSUPPORTED_FORMAT',
    message:
      'Unsupported image format. File header does not match known Tier 1 format signatures (JPEG, PNG, WebP, AVIF, JXL, GIF, HEIC, TIFF, BMP, SVG).',
  });
}
