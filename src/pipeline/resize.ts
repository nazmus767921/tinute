import type { RawImage } from '../codecs/types';

/**
 * High-quality bilinear interpolation downsampler for raw RGBA buffers.
 * Scales image proportionally such that max(width, height) <= maxDimension.
 */
export function resizeRawImage(image: RawImage, maxDimension?: number): RawImage {
  if (!maxDimension || maxDimension <= 0) {
    return image;
  }

  const { width, height, data } = image;
  const currentMax = Math.max(width, height);
  if (currentMax <= maxDimension) {
    return image;
  }

  const scale = maxDimension / currentMax;
  const newWidth = Math.max(1, Math.round(width * scale));
  const newHeight = Math.max(1, Math.round(height * scale));
  const newData = new Uint8ClampedArray(newWidth * newHeight * 4);

  const xRatio = (width - 1) / (newWidth === 1 ? 1 : newWidth - 1);
  const yRatio = (height - 1) / (newHeight === 1 ? 1 : newHeight - 1);

  for (let y = 0; y < newHeight; y++) {
    const srcY = y * yRatio;
    const yFloor = Math.floor(srcY);
    const yCeil = Math.min(height - 1, yFloor + 1);
    const yWeight = srcY - yFloor;

    for (let x = 0; x < newWidth; x++) {
      const srcX = x * xRatio;
      const xFloor = Math.floor(srcX);
      const xCeil = Math.min(width - 1, xFloor + 1);
      const xWeight = srcX - xFloor;

      const idxTL = (yFloor * width + xFloor) * 4;
      const idxTR = (yFloor * width + xCeil) * 4;
      const idxBL = (yCeil * width + xFloor) * 4;
      const idxBR = (yCeil * width + xCeil) * 4;

      const dstIdx = (y * newWidth + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = data[idxTL + c]! * (1 - xWeight) + data[idxTR + c]! * xWeight;
        const bottom = data[idxBL + c]! * (1 - xWeight) + data[idxBR + c]! * xWeight;
        newData[dstIdx + c] = Math.round(top * (1 - yWeight) + bottom * yWeight);
      }
    }
  }

  return {
    width: newWidth,
    height: newHeight,
    data: newData,
  };
}
