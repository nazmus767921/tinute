import { afterEach, describe, expect, it, vi } from 'vitest';
import { webpCodec } from '../webpCodec';
import { verifyBitExact } from '../../pipeline/qualityGate';

const image = { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 4).fill(255) };

afterEach(() => {
  vi.unstubAllGlobals();
});

function installCanvas(convertToBlob: () => Promise<Blob>) {
  vi.stubGlobal(
    'ImageData',
    class {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    },
  );
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext() {
        return { putImageData() {} };
      }
      convertToBlob = convertToBlob;
    },
  );
}

describe('Native lossy WebP encoding', () => {
  it('uses a supported browser encoder before loading WASM', async () => {
    const expected = await webpCodec.encode(image, { quality: 70 });
    installCanvas(async () => new Blob([expected], { type: 'image/webp' }));
    const output = await webpCodec.encode(image, { quality: 90 });
    expect(new Uint8Array(output)).toEqual(new Uint8Array(expected));
  });

  it.each(['unsupported', 'throws'])(
    'falls back to WASM when native encoding %s',
    async (failure) => {
      installCanvas(async () => {
        if (failure === 'throws') throw new Error('No encoder');
        return new Blob(['not webp'], { type: 'image/png' });
      });
      const output = await webpCodec.encode(image, { quality: 80 });
      const decoded = await webpCodec.decode(output);
      expect([decoded.width, decoded.height]).toEqual([16, 16]);
    },
  );

  it('retains the bit-exact WASM path for lossless output', async () => {
    installCanvas(async () => {
      throw new Error('Lossless must not use canvas');
    });
    const output = await webpCodec.encode(image, { lossless: true });
    expect(verifyBitExact(image, await webpCodec.decode(output))).toBe(true);
  });
});
