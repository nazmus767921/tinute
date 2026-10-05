import { loadWasmModule } from './wasmLoader';
import type { ImageCodec, JxlEncodeOptions, RawImage } from './types';
import type { EncodeOptions as JsquashJxlOptions } from '@jsquash/jxl/meta.js';

type JxlEncodeFn = (data: ImageData, options?: Partial<JsquashJxlOptions>) => Promise<ArrayBuffer>;
type JxlDecodeFn = (buffer: ArrayBuffer) => Promise<ImageData>;

let jxlEncInitPromise: Promise<void> | null = null;
let jxlDecInitPromise: Promise<void> | null = null;

async function ensureJxlEncoder(): Promise<JxlEncodeFn> {
  const { init, default: encode } = await import('@jsquash/jxl/encode.js');
  if (!jxlEncInitPromise) {
    jxlEncInitPromise = (async () => {
      const wasm = await loadWasmModule('jxl_enc.wasm');
      await init(wasm);
    })();
  }
  await jxlEncInitPromise;
  return encode;
}

async function ensureJxlDecoder(): Promise<JxlDecodeFn> {
  const { init, default: decode } = await import('@jsquash/jxl/decode.js');
  if (!jxlDecInitPromise) {
    jxlDecInitPromise = (async () => {
      const wasm = await loadWasmModule('jxl_dec.wasm');
      await init(wasm);
    })();
  }
  await jxlDecInitPromise;
  return decode;
}

export const jxlCodec: ImageCodec<JxlEncodeOptions> = {
  id: 'jxl',
  mimeType: 'image/jxl',
  defaultExtension: 'jxl',
  canEncode: true,

  async decode(buffer: ArrayBuffer): Promise<RawImage> {
    const decode = await ensureJxlDecoder();
    const result = await decode(buffer);
    return {
      data: result.data,
      width: result.width,
      height: result.height,
    };
  },

  async encode(image: RawImage, options: JxlEncodeOptions = {}): Promise<ArrayBuffer> {
    const encode = await ensureJxlEncoder();
    const imgDataLike = {
      data: image.data,
      width: image.width,
      height: image.height,
      colorSpace: 'srgb' as const,
    } as ImageData;

    const isLossless = options.lossless ?? false;
    const quality = options.quality ?? 75;
    const effort = options.effort ?? 7;

    return await encode(imgDataLike, {
      quality: isLossless ? 100 : quality,
      lossless: isLossless,
      effort,
      decodingSpeedTier: options.decodingSpeed ?? 0,
    });
  },
};
