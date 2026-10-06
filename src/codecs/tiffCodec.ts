import UTIF from 'utif';
import type { ImageCodec, TiffEncodeOptions, RawImage } from './types';

export const tiffCodec: ImageCodec<TiffEncodeOptions> = {
  id: 'tiff',
  mimeType: 'image/tiff',
  defaultExtension: 'tiff',
  canEncode: true,

  async decode(buffer: ArrayBuffer): Promise<RawImage> {
    const ifds = UTIF.decode(buffer);
    if (!ifds || ifds.length === 0 || !ifds[0]) {
      throw new Error('Invalid or corrupted TIFF image: No IFD found.');
    }

    if (ifds.length !== 1)
      throw new Error('Multi-page TIFF processing is unsupported. Choose a single-page image.');
    const firstIfd = ifds[0];
    const bits = firstIfd.t258;
    const depths =
      typeof bits === 'number'
        ? [bits]
        : Array.isArray(bits)
          ? bits
          : bits instanceof Uint8Array
            ? Array.from(bits)
            : [];
    if (depths.some((value) => Number(value) > 8))
      throw new Error('High-bit-depth TIFF processing is unsupported. Choose an 8-bit image.');
    UTIF.decodeImage(buffer, firstIfd);

    const width = firstIfd.width;
    const height = firstIfd.height;
    const rgba = UTIF.toRGBA8(firstIfd);

    return {
      data: new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength),
      width,
      height,
    };
  },

  async encode(image: RawImage): Promise<ArrayBuffer> {
    const { data, width, height } = image;
    const rgbaBytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const tiffBuffer = UTIF.encodeImage(rgbaBytes, width, height);
    return tiffBuffer;
  },
};
