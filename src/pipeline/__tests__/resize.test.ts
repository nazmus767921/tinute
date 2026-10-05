import { describe, it, expect } from 'vitest';
import { resizeRawImage } from '../resize';
import type { RawImage } from '../../codecs/types';

describe('resizeRawImage bilinear downsampler', () => {
  it('returns original image unchanged if maxDimension is undefined or 0', () => {
    const img: RawImage = {
      width: 100,
      height: 50,
      data: new Uint8ClampedArray(100 * 50 * 4),
    };
    expect(resizeRawImage(img)).toBe(img);
    expect(resizeRawImage(img, 0)).toBe(img);
  });

  it('returns original image unchanged if image dimensions are already within maxDimension', () => {
    const img: RawImage = {
      width: 100,
      height: 50,
      data: new Uint8ClampedArray(100 * 50 * 4),
    };
    expect(resizeRawImage(img, 200)).toBe(img);
    expect(resizeRawImage(img, 100)).toBe(img);
  });

  it('proportionally downscales image when max dimension is exceeded', () => {
    const width = 100;
    const height = 50;
    const data = new Uint8ClampedArray(width * height * 4);
    // Fill with solid red
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }

    const img: RawImage = { width, height, data };
    const resized = resizeRawImage(img, 50);

    expect(resized.width).toBe(50);
    expect(resized.height).toBe(25);
    expect(resized.data.length).toBe(50 * 25 * 4);
    // Preserves color values
    expect(resized.data[0]).toBe(255);
    expect(resized.data[1]).toBe(0);
    expect(resized.data[2]).toBe(0);
    expect(resized.data[3]).toBe(255);
  });
});
