import { loadWasmModule } from './wasmLoader';
import type { ImageCodec, AvifEncodeOptions, RawImage } from './types';
import type { EncodeOptions as JsquashAvifOptions } from '@jsquash/avif/meta.js';
import type { AVIFModule } from '@jsquash/avif/codec/enc/avif_enc.js';

type AvifEncodeFn = (
  data: ImageData,
  options?: Partial<JsquashAvifOptions>,
) => Promise<ArrayBuffer>;
type AvifDecodeFn = (buffer: ArrayBuffer) => Promise<ImageData | null>;

let avifEncInitPromise: Promise<AVIFModule> | null = null;
let avifDecInitPromise: Promise<void> | null = null;

async function ensureAvifEncoder(): Promise<AvifEncodeFn> {
  const { default: factory } = await import('@jsquash/avif/codec/enc/avif_enc.js');
  const { initEmscriptenModule } = await import('@jsquash/avif/utils.js');
  const { defaultOptions } = await import('@jsquash/avif/meta.js');
  if (!avifEncInitPromise) {
    avifEncInitPromise = (async () => {
      const wasm = await loadWasmModule('avif_enc.wasm');
      const encoder = await initEmscriptenModule(factory, wasm);
      if (!encoder) throw new Error('AVIF initialization failed.');
      return encoder;
    })();
    void avifEncInitPromise.catch(() => {
      avifEncInitPromise = null;
    });
  }
  const module = await avifEncInitPromise;
  return async (data, options = {}) => {
    const resolved = { ...defaultOptions, ...options };
    if (resolved.lossless) {
      resolved.quality = 100;
      resolved.qualityAlpha = -1;
      resolved.subsample = 3;
    }
    const output = module.encode(
      new Uint8Array(data.data.buffer, data.data.byteOffset, data.data.byteLength),
      data.width,
      data.height,
      resolved,
    );
    if (!output) throw new Error('AVIF encoding failed.');
    return output.buffer;
  };
}

async function ensureAvifDecoder(): Promise<AvifDecodeFn> {
  const { init, default: decode } = await import('@jsquash/avif/decode.js');
  if (!avifDecInitPromise) {
    avifDecInitPromise = (async () => {
      const wasm = await loadWasmModule('avif_dec.wasm');
      await init(wasm);
    })();
  }
  await avifDecInitPromise;
  return decode;
}

export const avifCodec: ImageCodec<AvifEncodeOptions> = {
  id: 'avif',
  mimeType: 'image/avif',
  defaultExtension: 'avif',
  canEncode: true,

  async decode(buffer: ArrayBuffer): Promise<RawImage> {
    const decode = await ensureAvifDecoder();
    const result = await decode(buffer);
    if (!result) {
      throw new Error('Failed to decode AVIF: decoder returned null.');
    }
    return {
      data: result.data,
      width: result.width,
      height: result.height,
    };
  },

  async encode(image: RawImage, options: AvifEncodeOptions = {}): Promise<ArrayBuffer> {
    const encode = await ensureAvifEncoder();
    const imgDataLike = {
      data: image.data,
      width: image.width,
      height: image.height,
      colorSpace: 'srgb' as const,
    } as ImageData;

    const isLossless = options.lossless ?? false;
    const quality = options.quality ?? 60;
    const speed = options.speed ?? 6;

    return await encode(imgDataLike, {
      quality: isLossless ? 100 : quality,
      lossless: isLossless,
      speed,
    });
  },
};
