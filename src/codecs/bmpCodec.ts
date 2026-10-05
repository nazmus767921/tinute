import type { ImageCodec, BmpEncodeOptions, RawImage } from './types';

/**
 * Pure TypeScript BMP Codec supporting 24-bit BGR and 32-bit BGRA (with alpha),
 * bottom-up and top-down scanlines, and 4-byte row alignment.
 */
export const bmpCodec: ImageCodec<BmpEncodeOptions> = {
  id: 'bmp',
  mimeType: 'image/bmp',
  defaultExtension: 'bmp',
  canEncode: true,

  async decode(buffer: ArrayBuffer): Promise<RawImage> {
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    if (buffer.byteLength < 54) {
      throw new Error('Invalid BMP file: Header too small.');
    }

    // Magic bytes 'BM' (0x42, 0x4D)
    if (u8[0] !== 0x42 || u8[1] !== 0x4d) {
      throw new Error('Invalid BMP magic bytes.');
    }

    const dataOffset = view.getUint32(10, true);
    const headerSize = view.getUint32(14, true);

    if (headerSize < 40) {
      throw new Error(`Unsupported legacy BMP header size: ${headerSize}`);
    }

    const width = view.getInt32(18, true);
    const rawHeight = view.getInt32(22, true);
    const height = Math.abs(rawHeight);
    const isTopDown = rawHeight < 0;
    const bpp = view.getUint16(28, true);
    const compression = view.getUint32(30, true);

    // 0 = BI_RGB (uncompressed), 3 = BI_BITFIELDS
    if (compression !== 0 && compression !== 3) {
      throw new Error(`Unsupported BMP compression mode: ${compression}`);
    }

    if (bpp !== 24 && bpp !== 32) {
      throw new Error(`Unsupported BMP bits per pixel: ${bpp} (only 24-bit and 32-bit supported)`);
    }

    const outData = new Uint8ClampedArray(width * height * 4);
    const bytesPerPixel = bpp / 8;
    const rowStride = Math.ceil((width * bytesPerPixel) / 4) * 4;

    for (let y = 0; y < height; y++) {
      const srcY = isTopDown ? y : height - 1 - y;
      const rowStart = dataOffset + srcY * rowStride;

      for (let x = 0; x < width; x++) {
        const srcPx = rowStart + x * bytesPerPixel;
        const dstPx = (y * width + x) * 4;

        if (bpp === 32) {
          outData[dstPx] = u8[srcPx + 2]!; // R
          outData[dstPx + 1] = u8[srcPx + 1]!; // G
          outData[dstPx + 2] = u8[srcPx]!; // B
          outData[dstPx + 3] = u8[srcPx + 3]!; // A
        } else {
          // 24-bit BGR
          outData[dstPx] = u8[srcPx + 2]!; // R
          outData[dstPx + 1] = u8[srcPx + 1]!; // G
          outData[dstPx + 2] = u8[srcPx]!; // B
          outData[dstPx + 3] = 255; // Opaque alpha
        }
      }
    }

    return {
      data: outData,
      width,
      height,
    };
  },

  async encode(image: RawImage, options: BmpEncodeOptions = {}): Promise<ArrayBuffer> {
    const { width, height, data } = image;
    const bitCount = options.bitCount ?? 32;

    if (bitCount === 24) {
      const rowStride = Math.ceil((width * 3) / 4) * 4;
      const imageSize = rowStride * height;
      const fileSize = 54 + imageSize;

      const buffer = new ArrayBuffer(fileSize);
      const view = new DataView(buffer);
      const u8 = new Uint8Array(buffer);

      // BITMAPFILEHEADER (14 bytes)
      u8[0] = 0x42;
      u8[1] = 0x4d; // 'BM'
      view.setUint32(2, fileSize, true);
      view.setUint32(6, 0, true);
      view.setUint32(10, 54, true);

      // BITMAPINFOHEADER (40 bytes)
      view.setUint32(14, 40, true);
      view.setInt32(18, width, true);
      view.setInt32(22, -height, true); // top-down
      view.setUint16(26, 1, true);
      view.setUint16(28, 24, true);
      view.setUint32(30, 0, true); // BI_RGB
      view.setUint32(34, imageSize, true);
      view.setInt32(38, 2835, true);
      view.setInt32(42, 2835, true);
      view.setUint32(46, 0, true);
      view.setUint32(50, 0, true);

      for (let y = 0; y < height; y++) {
        const rowStart = 54 + y * rowStride;
        for (let x = 0; x < width; x++) {
          const srcIdx = (y * width + x) * 4;
          const dstIdx = rowStart + x * 3;
          u8[dstIdx] = data[srcIdx + 2]!; // B
          u8[dstIdx + 1] = data[srcIdx + 1]!; // G
          u8[dstIdx + 2] = data[srcIdx]!; // R
        }
      }

      return buffer;
    }

    // 32-bit BGRA with alpha
    const rowStride = width * 4;
    const imageSize = rowStride * height;
    const fileSize = 54 + imageSize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    // BITMAPFILEHEADER (14 bytes)
    u8[0] = 0x42;
    u8[1] = 0x4d; // 'BM'
    view.setUint32(2, fileSize, true);
    view.setUint32(6, 0, true);
    view.setUint32(10, 54, true);

    // BITMAPINFOHEADER (40 bytes)
    view.setUint32(14, 40, true);
    view.setInt32(18, width, true);
    view.setInt32(22, -height, true); // top-down
    view.setUint16(26, 1, true);
    view.setUint16(28, 32, true);
    view.setUint32(30, 0, true); // BI_RGB
    view.setUint32(34, imageSize, true);
    view.setInt32(38, 2835, true);
    view.setInt32(42, 2835, true);
    view.setUint32(46, 0, true);
    view.setUint32(50, 0, true);

    let p = 54;
    for (let i = 0; i < data.length; i += 4) {
      u8[p] = data[i + 2]!; // B
      u8[p + 1] = data[i + 1]!; // G
      u8[p + 2] = data[i]!; // R
      u8[p + 3] = data[i + 3]!; // A
      p += 4;
    }

    return buffer;
  },
};
