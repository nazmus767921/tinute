import { loadWasmModule } from './wasmLoader';
import type { ImageCodec, PngEncodeOptions, RawImage } from './types';

import type { OptimiseOptions } from '@jsquash/oxipng/meta.js';

type PngEncodeFn = (data: ImageData) => Promise<ArrayBuffer>;
type PngDecodeFn = (buffer: ArrayBuffer) => Promise<ImageData>;
type OxipngFn = (
  buffer: ArrayBuffer | ImageData,
  options?: Partial<OptimiseOptions>,
) => Promise<ArrayBuffer>;

let pngEncInitPromise: Promise<void> | null = null;
let pngDecInitPromise: Promise<void> | null = null;
let oxipngInitPromise: Promise<void> | null = null;

async function ensurePngEncoder(): Promise<PngEncodeFn> {
  const { init, default: encode } = await import('@jsquash/png/encode.js');
  if (!pngEncInitPromise) {
    pngEncInitPromise = (async () => {
      const wasm = await loadWasmModule('squoosh_png_bg.wasm');
      await init(wasm);
    })();
  }
  await pngEncInitPromise;
  return encode;
}

async function ensurePngDecoder(): Promise<PngDecodeFn> {
  const { init, default: decode } = await import('@jsquash/png/decode.js');
  if (!pngDecInitPromise) {
    pngDecInitPromise = (async () => {
      const wasm = await loadWasmModule('squoosh_png_bg.wasm');
      await init(wasm);
    })();
  }
  await pngDecInitPromise;
  return decode;
}

async function ensureOxipng(): Promise<OxipngFn> {
  // The wrapper auto-selects Rayon and spawns hardwareConcurrency subworkers in
  // isolated browsers. Match our single-thread binary explicitly and keep all
  // concurrency under Tinute's admission scheduler.
  const bindings = await import('@jsquash/oxipng/codec/pkg/squoosh_oxipng.js');
  if (!oxipngInitPromise) {
    oxipngInitPromise = (async () => {
      const wasm = await loadWasmModule('squoosh_oxipng_bg.wasm');
      await bindings.default(wasm);
    })();
    void oxipngInitPromise.catch(() => {
      oxipngInitPromise = null;
    });
  }
  await oxipngInitPromise;
  return async (data, options = {}) => {
    const level = options.level ?? 1;
    const interlace = options.interlace ?? false;
    const alpha = options.optimiseAlpha ?? false;
    const output =
      data instanceof ArrayBuffer
        ? bindings.optimise(new Uint8Array(data), level, interlace, alpha)
        : bindings.optimise_raw(data.data, data.width, data.height, level, interlace, alpha);
    return output.buffer;
  };
}

export const pngCodec: ImageCodec<PngEncodeOptions> & {
  optimise(pngBuffer: ArrayBuffer, options?: PngEncodeOptions): Promise<ArrayBuffer>;
} = {
  id: 'png',
  mimeType: 'image/png',
  defaultExtension: 'png',
  canEncode: true,

  async decode(buffer: ArrayBuffer): Promise<RawImage> {
    const decode = await ensurePngDecoder();
    const result = await decode(buffer);
    return {
      data: result.data,
      width: result.width,
      height: result.height,
    };
  },

  async encode(image: RawImage, options: PngEncodeOptions = {}): Promise<ArrayBuffer> {
    const encode = await ensurePngEncoder();
    const imgDataLike = {
      data: image.data,
      width: image.width,
      height: image.height,
      colorSpace: 'srgb' as const,
    } as ImageData;

    const rawPngBuffer = await encode(imgDataLike);

    // Apply OxiPNG optimization pass by default for PNG lossless compression
    const optimise = await ensureOxipng();
    return await optimise(rawPngBuffer, {
      level: options.level ?? 2,
      interlace: options.interlace ?? false,
      optimiseAlpha: options.optimiseAlpha ?? true,
    });
  },

  async optimise(pngBuffer: ArrayBuffer, options: PngEncodeOptions = {}): Promise<ArrayBuffer> {
    const optimise = await ensureOxipng();
    return await optimise(pngBuffer, {
      level: options.level ?? 2,
      interlace: options.interlace ?? false,
      optimiseAlpha: options.optimiseAlpha ?? true,
    });
  },
};
