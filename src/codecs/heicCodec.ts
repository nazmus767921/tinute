import type { ImageCodec, BaseEncodeOptions, RawImage } from './types';
import type { HeifDecoder as HeifDecoderType } from 'libheif-js';

interface LibHeifInstance {
  HeifDecoder: typeof HeifDecoderType;
}

let heifInstancePromise: Promise<LibHeifInstance> | null = null;

async function ensureLibHeif(): Promise<LibHeifInstance> {
  if (!heifInstancePromise) {
    heifInstancePromise = (async () => {
      // Load WASM binary
      let wasmBinary: ArrayBuffer;
      if (typeof process !== 'undefined' && process.versions?.node) {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const wasmPath = path.resolve(process.cwd(), 'public', 'wasm', 'libheif.wasm');
        const buf = fs.readFileSync(wasmPath);
        wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      } else {
        const response = await fetch('/wasm/libheif.wasm');
        wasmBinary = await response.arrayBuffer();
      }

      const { default: factory } = await import('libheif-js/libheif-wasm/libheif.js');

      return await factory({ wasmBinary });
    })();
  }
  return heifInstancePromise;
}

export const heicCodec: ImageCodec<BaseEncodeOptions> = {
  id: 'heic',
  mimeType: 'image/heic',
  defaultExtension: 'heic',
  canEncode: false,

  async decode(buffer: ArrayBuffer): Promise<RawImage> {
    const libheif = await ensureLibHeif();
    const decoder = new libheif.HeifDecoder();
    const data = decoder.decode(buffer);

    if (!data || data.length === 0 || !data[0]) {
      throw new Error('Invalid or corrupted HEIC image: No readable image track found.');
    }

    const image = data[0];
    const width = image.get_width();
    const height = image.get_height();
    const rawData = new Uint8ClampedArray(width * height * 4);

    try {
      await new Promise<void>((resolve, reject) => {
        image.display({ data: rawData, width, height }, (displayData) => {
          if (!displayData) {
            return reject(new Error('Failed to render decoded HEIF image frame.'));
          }
          resolve();
        });
      });
    } finally {
      image.free();
    }

    return {
      data: rawData,
      width,
      height,
    };
  },

  async encode(): Promise<ArrayBuffer> {
    throw new Error(
      'HEIC encoding is not supported: HEIC is patent-encumbered and is decode-only in Tier 1.',
    );
  },
};
