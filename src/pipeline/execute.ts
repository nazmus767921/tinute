import { extractExif } from './metadata/exif';
import { PROCESSING_BUDGET_BYTES } from '../workers/admission';
import { encodeNative } from './native';
import { inspectImageDimensions } from './metadata/dimensions';
import { pngCodec } from '../codecs/pngCodec';
import { optimizePngStream } from './pngNative';
import { isAnimatedContainer, sanitizeOriginalMetadata } from './metadata/privacy';
import { sniffImage } from './sniff';
import { decodeImage } from './decode';
import { normalizeImage } from './normalize';
import { classifyImage } from './classify';
import { planOptimization } from './plan';
import { searchAndEncode } from './search';
import { guardOptimization } from './guard';
import { finalizeOptimization } from './finalize';
import {
  type Result,
  type FinalPipelineOutput,
  type PipelineError,
  type UserPipelineSettings,
  DEFAULT_PIPELINE_LIMITS,
  err,
  type EncodeResult,
  type PipelinePlan,
} from './types';

/**
 * End-to-end Image Pipeline Executor.
 * Selects a bounded native, container, or pixel-codec route with typed errors:
 * 1. Sniff (magic bytes, limits)
 * 2. Decode (to raw pixels + decompression bomb protection)
 * 3. Normalize (RGBA orientation & layout check)
 * 4. Classify (heuristics: colors, edge density, entropy)
 * 5. Plan (candidate encoders and parameter selection)
 * 6. Encode (one lossy preset encode; verify pixels only for lossless output)
 * 7. Guard (never-bigger rule)
 * 8. Finalize (metadata report and packaging)
 */
export async function executePipeline(
  jobId: string,
  inputBuffer: ArrayBuffer,
  settings: UserPipelineSettings,
): Promise<Result<FinalPipelineOutput, PipelineError>> {
  const startTime = performance.now();
  const limits = { ...DEFAULT_PIPELINE_LIMITS, ...(settings.limits ?? {}) };

  // 1. Sniff (magic bytes + file size limits)
  const sniffRes = sniffImage(inputBuffer, limits);
  if (!sniffRes.ok) return sniffRes;
  const { format: originalFormat } = sniffRes.value;

  if (isAnimatedContainer(inputBuffer, originalFormat)) {
    return err({
      code: 'UNSUPPORTED_FORMAT',
      message: 'Animated images are not supported yet. Choose a still image.',
    });
  }

  const dimensions = inspectImageDimensions(inputBuffer, originalFormat);
  if (dimensions && dimensions.width * dimensions.height > limits.maxPixelCount) {
    return err({
      code: 'DECOMPRESSION_BOMB_LIMIT_EXCEEDED',
      message: 'This image exceeds the processing pixel limit. Choose a smaller image.',
    });
  }
  const orientation = extractExif(inputBuffer).orientation;
  const target = settings.targetFormat === 'preserve' ? originalFormat : settings.targetFormat;
  const sameFormat = target === originalFormat;
  const compressedPngRoute =
    sameFormat && originalFormat === 'png' && !settings.maxDimension && orientation === 1;
  const nativeRoute =
    settings.mode !== 'lossless' &&
    ['jpeg', 'webp'].includes(target) &&
    ['jpeg', 'png', 'webp', 'avif', 'gif'].includes(originalFormat) &&
    typeof OffscreenCanvas !== 'undefined';
  const retainOnly =
    sameFormat &&
    !settings.maxDimension &&
    ((originalFormat === 'jpeg' && settings.mode === 'lossless') ||
      ['heic', 'svg', 'tiff', 'bmp', 'gif'].includes(originalFormat));
  if (dimensions && !retainOnly) {
    const pixels = dimensions.width * dimensions.height;
    const bytesPerPixel = nativeRoute || compressedPngRoute ? 12 : 24;
    if (pixels * bytesPerPixel + 32 * 1024 * 1024 > PROCESSING_BUDGET_BYTES)
      return err({
        code: 'DECOMPRESSION_BOMB_LIMIT_EXCEEDED',
        message:
          'This image exceeds the processing memory budget. Reduce its dimensions and try again.',
      });
  }
  if (originalFormat === 'jxl' && !dimensions)
    return err({
      code: 'UNSUPPORTED_FORMAT',
      message: 'Safe dimension inspection for JPEG XL is unavailable. Choose another image format.',
    });
  const fallback =
    !settings.maxDimension &&
    (orientation === 1 || originalFormat === 'jpeg') &&
    (sameFormat || settings.targetFormat === 'auto')
      ? settings.stripMetadata
        ? sanitizeOriginalMetadata(inputBuffer, originalFormat)
        : inputBuffer
      : null;
  const finish = (encoded: EncodeResult, plan: PipelinePlan) => {
    const guarded = guardOptimization(inputBuffer, encoded, originalFormat, {
      fallbackBuffer: fallback,
    });
    if (!guarded.ok) return guarded;
    if (guarded.value.finalSize > limits.maxFileSizeBytes)
      return err({
        code: 'ENCODE_ERROR' as const,
        message: 'The result exceeds the output size limit. Reduce image dimensions and try again.',
      });
    return finalizeOptimization(
      jobId,
      guarded.value,
      plan,
      settings,
      originalFormat,
      Math.round(performance.now() - startTime),
    );
  };
  const simplePlan = (format: typeof originalFormat): PipelinePlan => ({
    targetFormat: format,
    candidateEncoders: [format],
    mode: settings.mode,
    encodeOptions: {},
    classification: 'photo',
  });
  // Preserve compressed JPEG pixels in lossless mode; unsupported preservation never converts.
  if (
    sameFormat &&
    ((originalFormat === 'jpeg' && settings.mode === 'lossless') ||
      ['heic', 'svg', 'tiff', 'bmp', 'gif'].includes(originalFormat))
  ) {
    if (!fallback)
      return err({
        code: 'UNSUPPORTED_FORMAT',
        message:
          'Same-format processing with these settings is unavailable. Choose another output format or keep the original without removing metadata.',
      });
    return finish(
      {
        outputBuffer: fallback,
        format: originalFormat,
        qualityScore: 100,
        qualityVerified: true,
        isLosslessBitExact: true,
        durationMs: 0,
      },
      simplePlan(originalFormat),
    );
  }
  if (compressedPngRoute) {
    const source = settings.stripMetadata ? fallback : inputBuffer;
    if (!source)
      return err({
        code: 'DECODE_ERROR',
        message: 'Could not safely read PNG metadata. Choose another image.',
      });
    try {
      const outputBuffer =
        dimensions && dimensions.width * dimensions.height > 4_000_000
          ? await optimizePngStream(source)
          : await pngCodec.optimise(source, { level: 1, optimiseAlpha: false });
      return finish(
        {
          outputBuffer,
          format: 'png',
          qualityScore: 100,
          qualityVerified: true,
          isLosslessBitExact: true,
          durationMs: 0,
        },
        simplePlan('png'),
      );
    } catch (error) {
      return err({
        code: 'ENCODE_ERROR',
        message: 'Could not optimize this PNG. Try another image.',
        details: String(error),
      });
    }
  }
  if (target !== 'auto' && dimensions) {
    try {
      const native = await encodeNative(inputBuffer, originalFormat, target, settings);
      if (native) return finish(native, simplePlan(target));
    } catch (error) {
      // Do not repeat a failed large native allocation in a separate WASM heap.
      return err({
        code: 'ENCODE_ERROR',
        message:
          'Could not process this image within browser resources. Reduce image dimensions and try again.',
        details: String(error),
      });
    }
  }

  // A browser may lack the requested native encoder. Re-admit the larger pixel
  // route rather than silently allocating a WASM heap under a native estimate.
  if (
    dimensions &&
    dimensions.width * dimensions.height * 24 + 32 * 1024 * 1024 > PROCESSING_BUDGET_BYTES
  )
    return err({
      code: 'DECOMPRESSION_BOMB_LIMIT_EXCEEDED',
      message:
        'The available codec needs too much memory for this image. Reduce its dimensions and try again.',
    });

  // 2. Decode (to raw pixels + decompression-bomb pixel limit)
  const decodeRes = await decodeImage(inputBuffer, originalFormat, limits);
  if (!decodeRes.ok) return decodeRes;

  if (settings.mode === 'lossless' && decodeRes.value.metadata.colorSpace !== 'srgb') {
    return err({
      code: 'UNSUPPORTED_FORMAT',
      message:
        'Exact lossless conversion of this color profile is unavailable. Keep the original format or use high-quality compression.',
    });
  }
  // 3. Normalize (RGBA orientation & layout check + optional resize)
  const normRes = await normalizeImage(decodeRes.value, settings.maxDimension);
  if (!normRes.ok) return normRes;

  // 4. Classify (heuristics: colors, edge density, entropy)
  const classRes = classifyImage(normRes.value);
  if (!classRes.ok) return classRes;

  // 5. Plan (candidate encoders and parameter selection)
  const planRes = planOptimization(classRes.value, settings, originalFormat);
  if (!planRes.ok) return planRes;

  // 6. One bounded encode; rigorous verification only for lossless output.
  const searchRes = await searchAndEncode(normRes.value, planRes.value, settings);
  if (!searchRes.ok) return searchRes;

  return finish(searchRes.value, planRes.value);
}
