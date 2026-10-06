import { describe, expect, it, vi } from 'vitest';
import { deflateSync, inflateSync } from 'node:zlib';
import { optimizePngStream } from '../pngNative';
import { pngCodec } from '../../codecs/pngCodec';
function chunk(type: string, data: Uint8Array) {
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length);
  output.write(type, 4, 'ascii');
  output.set(data, 8);
  let crc = 0xffffffff;
  for (const byte of output.subarray(4, output.length - 4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  output.writeUInt32BE((crc ^ 0xffffffff) >>> 0, output.length - 4);
  return output;
}
async function fixture(interlace = false, wrongDimensions = false) {
  const data = Uint8ClampedArray.from({ length: 16 * 12 * 4 }, (_, i) => (i % 17) * 13);
  const encoded = Buffer.from(
    await pngCodec.encode({ width: 16, height: 12, data }, { interlace, optimiseAlpha: false }),
  );
  const parts: Buffer[] = [];
  const idat: Buffer[] = [];
  let header: Buffer | undefined;
  for (let offset = 8; offset < encoded.length;) {
    const length = encoded.readUInt32BE(offset);
    const type = encoded.toString('ascii', offset + 4, offset + 8);
    const payload = encoded.subarray(offset + 8, offset + 8 + length);
    if (type === 'IDAT') idat.push(payload);
    else if (type === 'IHDR') {
      const copy = Buffer.from(payload);
      if (wrongDimensions) {
        copy.writeUInt32BE(1);
        copy.writeUInt32BE(1, 4);
      }
      header = chunk(type, copy);
    } else if (type !== 'IEND') parts.push(chunk(type, payload));
    offset += length + 12;
  }
  const bloated = deflateSync(inflateSync(Buffer.concat(idat)), { level: 0 });
  return Uint8Array.from(
    Buffer.concat([
      encoded.subarray(0, 8),
      header!,
      ...parts,
      chunk('IDAT', bloated),
      chunk('IEND', new Uint8Array()),
    ]),
  ).buffer;
}
describe('native lossless PNG stream', () => {
  it('retains complete source bytes when the compression time budget is exhausted', async () => {
    const source = await fixture();
    expect(await optimizePngStream(source, undefined, 0)).toBe(source);
  });
  it('still rejects oversized inflation after compression time is exhausted', async () => {
    await expect(optimizePngStream(await fixture(false, true), undefined, 0)).rejects.toThrow(
      /declared dimensions/,
    );
  });
  it('preserves scanlines across multiple compression windows', async () => {
    const width = 257,
      height = 1025,
      row = 1 + width * 4;
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = 6;
    const raw = Buffer.from(
      Array.from({ length: row * height }, (_, i) => (i % row === 0 ? 0 : (i % 263) & 255)),
    );
    const source = Uint8Array.from(
      Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(raw, { level: 0 })),
        chunk('IEND', new Uint8Array()),
      ]),
    ).buffer;
    const output = Buffer.from(await optimizePngStream(source));
    expect(output.length).toBeLessThan(source.byteLength);
    const length = output.readUInt32BE(33);
    expect(inflateSync(output.subarray(41, 41 + length)).equals(raw)).toBe(true);
  });
  it('preserves 16-bit scanline bytes and the original bit depth', async () => {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(2);
    header.writeUInt32BE(2, 4);
    header[8] = 16;
    header[9] = 6;
    const raw = Buffer.from(
      Array.from({ length: 34 }, (_, i) => (i % 17 === 0 ? 0 : (i * 7) & 255)),
    );
    const source = Uint8Array.from(
      Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(raw, { level: 0 })),
        chunk('IEND', new Uint8Array()),
      ]),
    ).buffer;
    const output = Buffer.from(await optimizePngStream(source));
    expect(output[24]).toBe(16);
    const length = output.readUInt32BE(33);
    expect(inflateSync(output.subarray(41, 41 + length))).toEqual(raw);
  });
  it.each([false, true])('preserves pixels and transparency (interlace=%s)', async (interlace) => {
    const source = await fixture(interlace);
    const output = await optimizePngStream(source);
    expect(output.byteLength).toBeLessThan(source.byteLength);
    const [before, after] = await Promise.all([pngCodec.decode(source), pngCodec.decode(output)]);
    expect(after).toEqual(before);
  });
  it('rejects invalid chunk checksums', async () => {
    const source = new Uint8Array(await fixture());
    source[source.length - 1]! ^= 1;
    await expect(optimizePngStream(source.buffer)).rejects.toThrow(/checksum/);
  });
  it('stops inflation beyond the declared scanline budget', async () => {
    await expect(optimizePngStream(await fixture(false, true))).rejects.toThrow(
      /declared dimensions/,
    );
  });
  it('retains compressed pixels when native streams are unavailable', async () => {
    const source = await fixture();
    vi.stubGlobal('DecompressionStream', undefined);
    try {
      expect(await optimizePngStream(source)).toBe(source);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
