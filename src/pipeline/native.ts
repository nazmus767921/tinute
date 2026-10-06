import type { EncodeResult, ImageFormat, UserPipelineSettings } from './types';

/** Bitmap surfaces stay native: no full-image getImageData or WASM pixel heap. */
export async function encodeNative(
  input: ArrayBuffer,
  source: ImageFormat,
  target: ImageFormat,
  settings: UserPipelineSettings,
): Promise<EncodeResult | null> {
  if (
    settings.mode === 'lossless' ||
    !['jpeg', 'webp'].includes(target) ||
    !['jpeg', 'png', 'webp', 'avif', 'gif'].includes(source) ||
    typeof createImageBitmap === 'undefined' ||
    typeof OffscreenCanvas === 'undefined'
  )
    return null;
  const start = performance.now();
  const bitmap = await createImageBitmap(new Blob([input], { type: `image/${source}` }));
  let canvas: OffscreenCanvas | undefined;
  try {
    const scale = settings.maxDimension
      ? Math.min(1, settings.maxDimension / Math.max(bitmap.width, bitmap.height))
      : 1;
    canvas = new OffscreenCanvas(
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    );
    const context = canvas.getContext('2d');
    if (!context) return null;
    if (target === 'jpeg') {
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const quality = Math.max(1, Math.min(99, settings.qualityTarget ?? 80));
    const blob = await canvas.convertToBlob({ type: `image/${target}`, quality: quality / 100 });
    if (blob.type !== `image/${target}`) return null;
    return {
      outputBuffer: await blob.arrayBuffer(),
      format: target,
      qualityScore: 0,
      qualityVerified: false,
      qualityParam: quality,
      iterations: 0,
      isLosslessBitExact: false,
      durationMs: Math.round(performance.now() - start),
    };
  } finally {
    bitmap.close();
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
  }
}
