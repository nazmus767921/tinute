import omggif from 'omggif';
import type { ImageCodec, GifEncodeOptions, RawImage } from './types';

const { GifReader, GifWriter } = omggif;

export interface GifFrameInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  delay: number;
  disposal: number;
}

export interface GifMetadata {
  frameCount: number;
  loopCount: number;
  durationMs: number;
  frames: GifFrameInfo[];
}

/**
 * Builds an indexed color palette (up to 256 colors) from RGBA pixel data.
 * Supports binary alpha transparency.
 */
function quantizeToPalette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  maxColors = 256,
): { palette: number[]; indexedPixels: Uint8Array; transparentIndex: number | null } {
  const pixelCount = width * height;
  const colorMap = new Map<number, number>();
  let hasTransparency = false;

  // 1. Identify distinct RGB colors and transparency
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a < 128) {
      hasTransparency = true;
      continue;
    }
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const rgb = ((r & 248) << 16) | ((g & 248) << 8) | (b & 248);
    colorMap.set(rgb, (colorMap.get(rgb) ?? 0) + 1);
  }

  const palette: number[] = [];
  let transparentIndex: number | null = null;

  if (hasTransparency) {
    transparentIndex = 0;
    palette.push(0x000000); // Transparent placeholder color
  }

  const availableSlots = hasTransparency ? maxColors - 1 : maxColors;

  // 2. Select most frequent colors if distinct colors exceed available palette slots
  const sortedColors = Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, availableSlots)
    .map(([color]) => color);

  for (const c of sortedColors) {
    palette.push(c);
  }

  // Ensure palette has at least 2 entries (GIF requirement)
  while (palette.length < 2) {
    palette.push(0x000000);
  }

  // Pre-extract palette components for nearest-neighbor lookups
  const palR = new Uint8Array(palette.length);
  const palG = new Uint8Array(palette.length);
  const palB = new Uint8Array(palette.length);
  for (let i = 0; i < palette.length; i++) {
    const c = palette[i]!;
    palR[i] = (c >> 16) & 0xff;
    palG[i] = (c >> 8) & 0xff;
    palB[i] = c & 0xff;
  }

  const colorToIndex = new Map<number, number>();
  for (let i = 0; i < palette.length; i++) {
    if (i !== transparentIndex) {
      colorToIndex.set(palette[i]!, i);
    }
  }

  // 3. Map each pixel to palette index
  const indexedPixels = new Uint8Array(pixelCount);
  const searchStart = hasTransparency ? 1 : 0;

  for (let p = 0; p < pixelCount; p++) {
    const idx = p * 4;
    const a = data[idx + 3]!;

    if (hasTransparency && a < 128) {
      indexedPixels[p] = transparentIndex!;
      continue;
    }

    const r = data[idx]!;
    const g = data[idx + 1]!;
    const b = data[idx + 2]!;
    const rgb = ((r & 248) << 16) | ((g & 248) << 8) | (b & 248);

    const exactMatch = colorToIndex.get(rgb);
    if (exactMatch !== undefined) {
      indexedPixels[p] = exactMatch;
      continue;
    }

    // Nearest color lookup (Euclidean distance in RGB)
    let bestDist = Infinity;
    let bestIdx = searchStart;
    for (let c = searchStart; c < palette.length; c++) {
      const dr = r - palR[c]!;
      const dg = g - palG[c]!;
      const db = b - palB[c]!;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = c;
        if (dist === 0) break;
      }
    }

    colorToIndex.set(rgb, bestIdx);
    indexedPixels[p] = bestIdx;
  }

  return { palette, indexedPixels, transparentIndex };
}

export const gifCodec: ImageCodec<GifEncodeOptions> & {
  inspectGif(buffer: ArrayBuffer): GifMetadata;
} = {
  id: 'gif',
  mimeType: 'image/gif',
  defaultExtension: 'gif',
  canEncode: true,

  inspectGif(buffer: ArrayBuffer): GifMetadata {
    const bytes = new Uint8Array(buffer);
    const reader = new GifReader(bytes);
    const frameCount = reader.numFrames();
    const frames: GifFrameInfo[] = [];
    let totalDelay = 0;

    for (let i = 0; i < frameCount; i++) {
      const info = reader.frameInfo(i);
      frames.push({
        x: info.x,
        y: info.y,
        width: info.width,
        height: info.height,
        delay: info.delay,
        disposal: info.disposal,
      });
      totalDelay += info.delay * 10; // delay in hundredths of a second -> ms
    }

    return {
      frameCount,
      loopCount: reader.loopCount() ?? 0,
      durationMs: totalDelay,
      frames,
    };
  },

  async decode(buffer: ArrayBuffer): Promise<RawImage> {
    const bytes = new Uint8Array(buffer);
    const reader = new GifReader(bytes);
    const width = reader.width;
    const height = reader.height;
    const data = new Uint8ClampedArray(width * height * 4);

    // Decode primary / initial frame to raw RGBA
    reader.decodeAndBlitFrameRGBA(0, data);

    return {
      data,
      width,
      height,
    };
  },

  async encode(image: RawImage, options: GifEncodeOptions = {}): Promise<ArrayBuffer> {
    const { width, height, data } = image;
    const paletteSize = Math.min(256, Math.max(2, options.paletteSize ?? 256));
    const { palette, indexedPixels, transparentIndex } = quantizeToPalette(
      data,
      width,
      height,
      paletteSize,
    );

    // Upper bound on GIF memory: width * height + header overhead
    const bufferSize = width * height * 2 + 2048;
    const outBuffer = new Uint8Array(bufferSize);
    const writer = new GifWriter(outBuffer, width, height, { loop: 0 });

    writer.addFrame(0, 0, width, height, indexedPixels as unknown as number[], {
      palette,
      transparent: transparentIndex ?? undefined,
      delay: 0,
    });

    const byteLength = writer.end();
    return outBuffer.buffer.slice(0, byteLength);
  },
};
