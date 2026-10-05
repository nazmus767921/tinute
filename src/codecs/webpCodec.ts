import { loadWasmModule } from './wasmLoader';
import type { ImageCodec, WebpEncodeOptions, RawImage } from './types';

import type { EncodeOptions as WebpOptions } from '@jsquash/webp/meta.js';

type WebpEncodeFn = (data: ImageData, options?: Partial<WebpOptions>) => Promise<ArrayBuffer>;
type WebpDecodeFn = (buffer: ArrayBuffer) => Promise<ImageData>;

let webpEncInitPromise: Promise<void> | null = null;
let webpDecInitPromise: Promise<void> | null = null;

async function ensureWebpEncoder(): Promise<WebpEncodeFn> {
  const { init, default: encode } = await import('@jsquash/webp/encode.js');
  if (!webpEncInitPromise) {
    webpEncInitPromise = (async () => {
      const wasm = await loadWasmModule('webp_enc.wasm');
      await init(wasm);
    })();
  }
  await webpEncInitPromise;
  return encode;
}

async function ensureWebpDecoder(): Promise<WebpDecodeFn> {
  const { init, default: decode } = await import('@jsquash/webp/decode.js');
  if (!webpDecInitPromise) {
    webpDecInitPromise = (async () => {
      const wasm = await loadWasmModule('webp_dec.wasm');
      await init(wasm);
    })();
  }
  await webpDecInitPromise;
  return decode;
}

export const webpCodec: ImageCodec<WebpEncodeOptions> = {
  id: 'webp',
  mimeType: 'image/webp',
  defaultExtension: 'webp',
  canEncode: true,

  async decode(buffer: ArrayBuffer): Promise<RawImage> {
    const decode = await ensureWebpDecoder();
    const result = await decode(buffer);
    return {
      data: result.data,
      width: result.width,
      height: result.height,
    };
  },

  async encode(image: RawImage, options: WebpEncodeOptions = {}): Promise<ArrayBuffer> {
    const encode = await ensureWebpEncoder();
    const imgDataLike = {
      data: image.data,
      width: image.width,
      height: image.height,
      colorSpace: 'srgb' as const,
    } as ImageData;

    const isLossless = options.lossless ?? false;
    const quality = options.quality ?? 75;

    return await encode(imgDataLike, {
      quality: isLossless ? 100 : quality,
      lossless: isLossless ? 1 : 0,
      method: options.method ?? 4,
      exact: isLossless ? 1 : 0,
    });
  },
};
