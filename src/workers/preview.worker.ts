import { sniffImage } from '../pipeline/sniff';
import { getCodec } from '../codecs';
import { inspectImageDimensions } from '../pipeline/metadata/dimensions';
import type { ImageFormat } from '../pipeline/types';

self.onmessage = async (
  event: MessageEvent<{ blob: Blob; format: ImageFormat; maxDimension: number }>,
) => {
  const { blob, maxDimension } = event.data;
  let format = event.data.format;
  let bitmap: ImageBitmap | undefined;
  let canvas: OffscreenCanvas | undefined;
  try {
    const header = await blob.slice(0, 65536).arrayBuffer();
    const detected = sniffImage(header);
    if (detected.ok) format = detected.value.format;
    const dims = inspectImageDimensions(header, format);
    if (!dims && ['jxl', 'heic'].includes(format))
      throw new Error('Safe preview dimensions are unavailable.');
    if (dims && dims.width * dims.height > 40_000_000)
      throw new Error('Preview exceeds the image pixel limit.');
    try {
      if (!dims) throw new Error('Native preview dimensions are unavailable.');
      bitmap = await createImageBitmap(blob);
    } catch {
      if (dims && dims.width * dims.height > 16_000_000)
        throw new Error('Software preview exceeds the safe memory limit.');
      const codec = getCodec(format);
      if (!codec) throw new Error('Preview format is unsupported.');
      const raw = await codec.decode(await blob.arrayBuffer());
      if (raw.width * raw.height > 40_000_000)
        throw new Error('Preview exceeds the image pixel limit.');
      bitmap = await createImageBitmap(new ImageData(raw.data, raw.width, raw.height));
    }
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    canvas = new OffscreenCanvas(
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    );
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Preview canvas is unavailable.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // PNG avoids adding lossy artifacts to the comparison itself.
    const output = await canvas.convertToBlob({ type: 'image/png' });
    self.postMessage({ blob: output });
  } catch (error) {
    self.postMessage({ error: String(error) });
  } finally {
    bitmap?.close();
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
  }
};
