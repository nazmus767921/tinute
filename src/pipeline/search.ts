import { getCodec } from '../codecs';
import { computePerceptualScore, verifyBitExact } from './qualityGate';
import {
  ok,
  err,
  type Result,
  type NormalizedImage,
  type PipelinePlan,
  type UserPipelineSettings,
  type EncodeResult,
  type PipelineError,
} from './types';
import type { RawImage } from '../codecs/types';

export interface SearchConfig {
  minIterations: number;
  maxIterations: number;
  minQuality: number;
  maxQuality: number;
}

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  minIterations: 5,
  maxIterations: 7,
  minQuality: 35,
  maxQuality: 95,
};

/**
 * Composites transparent RGBA image over an opaque white background.
 * Prevents black box artifacts when encoding to formats lacking alpha (JPEG).
 */
function compositeOverWhite(image: RawImage): RawImage {
  const data = image.data;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]! / 255;
    out[i] = Math.round(r * a + 255 * (1 - a));
    out[i + 1] = Math.round(g * a + 255 * (1 - a));
    out[i + 2] = Math.round(b * a + 255 * (1 - a));
    out[i + 3] = 255;
  }
  return { width: image.width, height: image.height, data: out };
}

/** One bounded encode; exhaustive pixel verification is restricted to lossless output. */
export async function searchAndEncode(
  normalized: NormalizedImage,
  plan: PipelinePlan,
  settings: UserPipelineSettings,
  _config: SearchConfig = DEFAULT_SEARCH_CONFIG,
): Promise<Result<EncodeResult, PipelineError>> {
  const codec = getCodec(plan.targetFormat);
  if (!codec || !codec.canEncode) {
    return err({
      code: 'UNSUPPORTED_FORMAT',
      message: `No encoder registered for target format: ${plan.targetFormat}`,
    });
  }

  const startTime = performance.now();
  const inputImage =
    plan.targetFormat === 'jpeg' && normalized.metadata.hasAlpha
      ? compositeOverWhite(normalized.image)
      : normalized.image;

  try {
    // 1. Lossless Mode: Skips binary search
    if (plan.mode === 'lossless') {
      const outputBuffer = await codec.encode(inputImage, plan.encodeOptions);
      const decoded = await codec.decode(outputBuffer);
      const isBitExact = verifyBitExact(inputImage, decoded);
      if (!isBitExact)
        return err({
          code: 'ENCODE_ERROR',
          message: 'This format cannot preserve every pixel. Choose a lossless output format.',
        });
      const qualityScore = 100.0;
      const durationMs = Math.round(performance.now() - startTime);

      return ok({
        outputBuffer,
        format: plan.targetFormat,
        qualityScore,
        qualityParam: 100,
        iterations: 0,
        isLosslessBitExact: isBitExact,
        durationMs,
      });
    }

    // 2. Visually Lossless Mode: Single-pass formats (PNG, GIF, TIFF, BMP)
    const isSearchable =
      plan.targetFormat === 'jpeg' ||
      plan.targetFormat === 'webp' ||
      plan.targetFormat === 'avif' ||
      plan.targetFormat === 'jxl';

    if (!isSearchable) {
      const outputBuffer = await codec.encode(inputImage, plan.encodeOptions);
      const decoded = await codec.decode(outputBuffer);
      const isBitExact = verifyBitExact(inputImage, decoded);
      const qualityScore = isBitExact ? 100.0 : computePerceptualScore(inputImage, decoded);
      const durationMs = Math.round(performance.now() - startTime);

      return ok({
        outputBuffer,
        format: plan.targetFormat,
        qualityScore,
        qualityParam: 100,
        iterations: 0,
        isLosslessBitExact: isBitExact,
        durationMs,
      });
    }

    // Quality is an encoder preset, not a measured whole-image perceptual guarantee.
    const quality = Math.max(1, Math.min(100, settings.qualityTarget ?? 80));
    const outputBuffer = await codec.encode(inputImage, { ...plan.encodeOptions, quality });
    return ok({
      outputBuffer,
      format: plan.targetFormat,
      qualityScore: 0,
      qualityVerified: false,
      qualityParam: quality,
      iterations: 0,
      isLosslessBitExact: false,
      durationMs: Math.round(performance.now() - startTime),
    });
  } catch (error) {
    return err({
      code: 'ENCODE_ERROR',
      message: `Failed during search and encode to ${plan.targetFormat.toUpperCase()}.`,
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
