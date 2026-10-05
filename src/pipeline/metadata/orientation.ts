import type { RawImage } from '../../codecs/types';

/**
 * Transforms raw RGBA image pixels according to EXIF Orientation tag (1-8),
 * producing an upright (Orientation 1: Top-Left) image.
 */
export function normalizeOrientation(image: RawImage, orientation: number): RawImage {
  if (orientation <= 1 || orientation > 8) {
    return image;
  }

  const { width: w, height: h, data: src } = image;
  const isSwapped = orientation >= 5;
  const outW = isSwapped ? h : w;
  const outH = isSwapped ? w : h;
  const dst = new Uint8ClampedArray(outW * outH * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let dstX: number;
      let dstY: number;

      switch (orientation) {
        case 2: // Mirror horizontal
          dstX = w - 1 - x;
          dstY = y;
          break;
        case 3: // Rotate 180
          dstX = w - 1 - x;
          dstY = h - 1 - y;
          break;
        case 4: // Mirror vertical
          dstX = x;
          dstY = h - 1 - y;
          break;
        case 5: // Transpose
          dstX = y;
          dstY = x;
          break;
        case 6: // Rotate 90 CW
          dstX = h - 1 - y;
          dstY = x;
          break;
        case 7: // Transverse
          dstX = h - 1 - y;
          dstY = w - 1 - x;
          break;
        case 8: // Rotate 270 CW (90 CCW)
          dstX = y;
          dstY = w - 1 - x;
          break;
        default:
          dstX = x;
          dstY = y;
          break;
      }

      const srcIdx = (y * w + x) * 4;
      const dstIdx = (dstY * outW + dstX) * 4;

      dst[dstIdx] = src[srcIdx]!;
      dst[dstIdx + 1] = src[srcIdx + 1]!;
      dst[dstIdx + 2] = src[srcIdx + 2]!;
      dst[dstIdx + 3] = src[srcIdx + 3]!;
    }
  }

  return {
    width: outW,
    height: outH,
    data: dst,
  };
}
