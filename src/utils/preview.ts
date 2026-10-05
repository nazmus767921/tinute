import { getCodec } from '../codecs';
import type { ImageFormat } from '../pipeline/types';
import { getMimeType } from './format';

const BROWSER_NATIVE_FORMATS = new Set<ImageFormat>(['jpeg', 'png', 'webp', 'gif', 'svg']);

/**
 * Creates an image preview URL (either direct Blob URL or Canvas-rasterized PNG for exotic formats like JXL/TIFF/HEIC).
 */
export async function createPreviewUrl(
  buffer: ArrayBuffer,
  format: ImageFormat,
): Promise<{ url: string; revoke: () => void }> {
  // If natively supported by all browsers, use zero-overhead Blob URL
  if (BROWSER_NATIVE_FORMATS.has(format)) {
    const blob = new Blob([buffer], { type: getMimeType(format) });
    const url = URL.createObjectURL(blob);
    return {
      url,
      revoke: () => URL.revokeObjectURL(url),
    };
  }

  // For AVIF, modern Chromium, Safari 16+, and Firefox support it natively
  if (format === 'avif' && typeof createImageBitmap !== 'undefined') {
    try {
      const blob = new Blob([buffer], { type: 'image/avif' });
      const bmp = await createImageBitmap(blob);
      bmp.close();
      const url = URL.createObjectURL(blob);
      return {
        url,
        revoke: () => URL.revokeObjectURL(url),
      };
    } catch {
      // Fall through to software WASM decode
    }
  }

  // Fallback: decode via WASM codec and render to an offscreen canvas
  try {
    const codec = getCodec(format);
    if (!codec) {
      const blob = new Blob([buffer], { type: getMimeType(format) });
      const url = URL.createObjectURL(blob);
      return { url, revoke: () => URL.revokeObjectURL(url) };
    }
    const rawImage = await codec.decode(buffer);

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = rawImage.width;
      canvas.height = rawImage.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const clampedData = new Uint8ClampedArray(
          rawImage.data.buffer,
          rawImage.data.byteOffset,
          rawImage.data.byteLength,
        );
        const imgData = new ImageData(clampedData, rawImage.width, rawImage.height);
        ctx.putImageData(imgData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        return {
          url: dataUrl,
          revoke: () => {},
        };
      }
    }
  } catch {
    // If decode fails, fallback to basic blob
  }

  const blob = new Blob([buffer], { type: getMimeType(format) });
  const url = URL.createObjectURL(blob);
  return {
    url,
    revoke: () => URL.revokeObjectURL(url),
  };
}
