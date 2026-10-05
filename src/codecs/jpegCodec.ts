import { loadWasmModule } from './wasmLoader';
import type { ImageCodec, JpegEncodeOptions, RawImage } from './types';

import type { EncodeOptions as MozJpegOptions } from '@jsquash/jpeg/meta.js';

type JpegEncodeFn = (data: ImageData, options?: Partial<MozJpegOptions>) => Promise<ArrayBuffer>;
type JpegDecodeFn = (buffer: ArrayBuffer) => Promise<ImageData>;

let encInitPromise: Promise<void> | null = null;
let decInitPromise: Promise<void> | null = null;

async function ensureEncoder(): Promise<JpegEncodeFn> {
  const { init, default: encode } = await import('@jsquash/jpeg/encode.js');
  if (!encInitPromise) {
    encInitPromise = (async () => {
      const wasm = await loadWasmModule('mozjpeg_enc.wasm');
      await init(wasm);
    })();
  }
  await encInitPromise;
  return encode;
}

async function ensureDecoder(): Promise<JpegDecodeFn> {
  const { init, default: decode } = await import('@jsquash/jpeg/decode.js');
  if (!decInitPromise) {
    decInitPromise = (async () => {
      const wasm = await loadWasmModule('mozjpeg_dec.wasm');
      await init(wasm);
    })();
  }
  await decInitPromise;
  return decode;
}

export const jpegCodec: ImageCodec<JpegEncodeOptions> = {
  id: 'jpeg',
  mimeType: 'image/jpeg',
  defaultExtension: 'jpg',
  canEncode: true,

  async decode(buffer: ArrayBuffer): Promise<RawImage> {
    const decode = await ensureDecoder();
    const result = await decode(buffer);
    return {
      data: result.data,
      width: result.width,
      height: result.height,
    };
  },

  async encode(image: RawImage, options: JpegEncodeOptions = {}): Promise<ArrayBuffer> {
    const encode = await ensureEncoder();
    // ImageData-compatible shape
    const imgDataLike = {
      data: image.data,
      width: image.width,
      height: image.height,
      colorSpace: 'srgb' as const,
    } as ImageData;

    const quality = options.quality ?? 75;
    return await encode(imgDataLike, {
      quality,
      progressive: options.progressive ?? true,
      optimize_coding: options.optimizeCoding ?? true,
      trellis_multipass: options.trellisMultipass ?? true,
      trellis_opt_zero: options.trellisOptZero ?? true,
      trellis_opt_table: options.trellisOptTable ?? true,
      auto_subsample: options.autoSubsample ?? true,
    });
  },
};
