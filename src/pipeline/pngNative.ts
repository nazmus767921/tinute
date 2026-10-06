import { Zlib } from 'fflate';
/** Recompress PNG's filtered scanlines without decoding or changing any pixels. */
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc(bytes: Uint8Array, start: number, end: number): number {
  let value = 0xffffffff;
  for (let i = start; i < end; i++) value = crcTable[(value ^ bytes[i]!) & 255]! ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
export async function optimizePngStream(
  input: ArrayBuffer,
  onStage?: (stage: string) => void,
  compressionBudgetMs = 4000,
): Promise<ArrayBuffer> {
  const compressionDeadline = performance.now() + compressionBudgetMs;
  onStage?.('start');
  if (typeof DecompressionStream === 'undefined') return input;
  const bytes = new Uint8Array(input);
  const view = new DataView(input);
  const chunks: Array<{ start: number; end: number; data: number; length: number; idat: boolean }> =
    [];
  let compressedSize = 0;
  let expected = 0;
  for (let offset = 8; offset < bytes.length;) {
    if (chunks.length >= 10000) throw new Error('PNG has too many chunks.');
    if (offset + 12 > bytes.length) throw new Error('Truncated PNG chunk.');
    const length = view.getUint32(offset);
    const end = offset + length + 12;
    if (end > bytes.length) throw new Error('Truncated PNG chunk.');
    if (crc(bytes, offset + 4, end - 4) !== view.getUint32(end - 4))
      throw new Error('PNG checksum is invalid.');
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === 'IHDR') {
      if (expected || offset !== 8) throw new Error('Invalid PNG header order.');
      if (length !== 13) throw new Error('Invalid PNG header.');
      const width = view.getUint32(offset + 8);
      const height = view.getUint32(offset + 12);
      const bits = bytes[offset + 16]!;
      const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[
        bytes[offset + 17]!
      ];
      if (!width || !height || !channels || ![1, 2, 4, 8, 16].includes(bits))
        throw new Error('Invalid PNG dimensions or bit depth.');
      const interlace = bytes[offset + 20]!;
      if (interlace > 1) throw new Error('Invalid PNG interlace method.');
      const passes = interlace
        ? [
            [0, 0, 8, 8],
            [4, 0, 8, 8],
            [0, 4, 4, 8],
            [2, 0, 4, 4],
            [0, 2, 2, 4],
            [1, 0, 2, 2],
            [0, 1, 1, 2],
          ]
        : [[0, 0, 1, 1]];
      for (const [x, y, dx, dy] of passes) {
        const w = Math.max(0, Math.ceil((width - x!) / dx!));
        const h = Math.max(0, Math.ceil((height - y!) / dy!));
        if (w && h) expected += (1 + Math.ceil((w * channels * bits) / 8)) * h;
      }
    }
    const idat = type === 'IDAT';
    if (idat) compressedSize += length;
    chunks.push({ start: offset, end, data: offset + 8, length, idat });
    offset = end;
  }
  if (!expected || !compressedSize) throw new Error('PNG image data is missing.');
  onStage?.('parsed');
  const dataChunks = chunks.filter((chunk) => chunk.idat);
  let index = 0;
  let position = 0;
  const compressed = new ReadableStream<Uint8Array>({
    pull(controller) {
      while (index < dataChunks.length && position === dataChunks[index]!.length) {
        index++;
        position = 0;
      }
      const chunk = dataChunks[index];
      if (!chunk) {
        controller.close();
        return;
      }
      const size = Math.min(65536, chunk.length - position);
      controller.enqueue(bytes.subarray(chunk.data + position, chunk.data + position + size));
      position += size;
    },
  });
  let inflated = 0;
  const checked = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      inflated += chunk.length;
      if (inflated > expected) throw new Error('PNG scanlines exceed the declared dimensions.');
      controller.enqueue(chunk);
    },
    flush() {
      if (inflated !== expected) throw new Error('PNG scanline length is invalid.');
      onStage?.('inflated');
    },
  });
  let compressor: Zlib;
  let compressionMs = 0;
  const pending = new Uint8Array(256 * 1024);
  let filled = 0;
  let compressionSkipped = false;
  const fastCompression = new TransformStream<Uint8Array, Uint8Array>({
    start(controller) {
      compressor = new Zlib({ level: 1 }, (data) => controller.enqueue(data));
    },
    transform(data) {
      let offset = 0;
      while (offset < data.length) {
        if (compressionSkipped || performance.now() >= compressionDeadline) {
          compressionSkipped = true;
          filled = 0;
          return;
        }
        const size = Math.min(pending.length - filled, data.length - offset);
        pending.set(data.subarray(offset, offset + size), filled);
        filled += size;
        offset += size;
        if (filled === pending.length) {
          const started = onStage ? performance.now() : 0;
          compressor.push(pending);
          if (onStage) compressionMs += performance.now() - started;
          filled = 0;
        }
      }
    },
    flush() {
      if (compressionSkipped) return;
      compressor.push(pending.subarray(0, filled), true);
      onStage?.(`compression-cpu:${Math.round(compressionMs)}`);
    },
  });
  const reader = compressed
    .pipeThrough(new DecompressionStream('deflate'))
    .pipeThrough(checked)
    .pipeThrough(fastCompression)
    .getReader();
  const outputChunks: Uint8Array[] = [];
  let size = 0;
  let keepOriginal = false;
  try {
    for (let item = await reader.read(); !item.done; item = await reader.read()) {
      const value = item.value;
      size += value.length;
      if (size >= compressedSize) {
        keepOriginal = true;
        outputChunks.length = 0;
      }
      if (!keepOriginal) outputChunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (keepOriginal || compressionSkipped) return input;
  onStage?.('compressed');
  const output = new Uint8Array(
    8 +
      chunks
        .filter((chunk) => !chunk.idat)
        .reduce((sum, chunk) => sum + chunk.end - chunk.start, 0) +
      size +
      12,
  );
  const outputView = new DataView(output.buffer);
  output.set(bytes.subarray(0, 8));
  let cursor = 8;
  let written = false;
  for (const chunk of chunks) {
    if (!chunk.idat) {
      output.set(bytes.subarray(chunk.start, chunk.end), cursor);
      cursor += chunk.end - chunk.start;
      continue;
    }
    if (written) continue;
    written = true;
    outputView.setUint32(cursor, size);
    output.set([73, 68, 65, 84], cursor + 4);
    for (const data of outputChunks) {
      output.set(data, cursor + 8);
      cursor += data.length;
    }
    const chunkStart = cursor - size;
    outputView.setUint32(cursor + 8, crc(output, chunkStart + 4, cursor + 8));
    cursor += 12;
  }
  onStage?.('complete');
  return output.buffer;
}
