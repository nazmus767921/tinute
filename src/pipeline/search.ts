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
import type {
  CodecEncodeOptions,
  JpegEncodeOptions,
  WebpEncodeOptions,
  AvifEncodeOptions,
  JxlEncodeOptions,
  RawImage,
} from '../codecs/types';

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

/**
 * Stage 6: Search & Encode
 *
 * For Lossless Mode:
 * - Skips binary search entirely.
 * - Encodes with lossless parameters.
 * - Decodes back to raw pixel buffer.
 * - Verifies bit-exact pixel hash and byte equality.
 * - Returns qualityScore: 100.0, isLosslessBitExact: true, iterations: 0.
 *
 * For Visually Lossless Mode:
 * - Binary search on quality parameter `q` against the SSIMULACRA2 threshold (5-7 iterations).
 * - Fast encoder speed during search iterations.
 * - One final encode at the SLOW high-efficiency setting for maximal compression density.
 * - Decodes final output and evaluates the verified perceptual quality score.
 */
export async function searchAndEncode(
  normalized: NormalizedImage,
  plan: PipelinePlan,
  settings: UserPipelineSettings,
  config: SearchConfig = DEFAULT_SEARCH_CONFIG,
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

    // 3. Visually Lossless Mode: Binary search across quality param (JPEG, WebP, AVIF, JXL)
    const threshold = settings.qualityTarget ?? 82;
    let low = config.minQuality;
    let high = config.maxQuality;
    const targetIterations = 6; // strictly within 5-7 iterations

    let bestPassed: { q: number; score: number } | null = null;
    let iterations = 0;

    for (let i = 0; i < targetIterations && low <= high; i++) {
      iterations++;
      const trialQ = Math.round((low + high) / 2);

      // Fast search settings
      let fastOptions: CodecEncodeOptions;
      if (plan.targetFormat === 'webp') {
        fastOptions = { quality: trialQ, lossless: false, method: 0 } as WebpEncodeOptions;
      } else if (plan.targetFormat === 'avif') {
        fastOptions = { quality: trialQ, lossless: false, speed: 8 } as AvifEncodeOptions;
      } else if (plan.targetFormat === 'jxl') {
        fastOptions = { quality: trialQ, lossless: false, effort: 3 } as JxlEncodeOptions;
      } else {
        fastOptions = {
          quality: trialQ,
          progressive: false,
          optimizeCoding: false,
          trellisMultipass: false,
          trellisOptZero: false,
          trellisOptTable: false,
        } as JpegEncodeOptions;
      }

      const trialBuffer = await codec.encode(inputImage, fastOptions);
      const trialDecoded = await codec.decode(trialBuffer);
      const trialScore = computePerceptualScore(inputImage, trialDecoded);

      if (trialScore >= threshold) {
        bestPassed = { q: trialQ, score: trialScore };
        high = trialQ - 1;
      } else {
        low = trialQ + 1;
      }
    }

    const optimalQ = bestPassed
      ? bestPassed.q
      : Math.min(config.maxQuality, Math.max(low, high, 80));

    // One final encode at the SLOW high-efficiency setting
    let slowOptions: CodecEncodeOptions;
    if (plan.targetFormat === 'webp') {
      slowOptions = { quality: optimalQ, lossless: false, method: 4 } as WebpEncodeOptions;
    } else if (plan.targetFormat === 'avif') {
      slowOptions = { quality: optimalQ, lossless: false, speed: 6 } as AvifEncodeOptions;
    } else if (plan.targetFormat === 'jxl') {
      slowOptions = { quality: optimalQ, lossless: false, effort: 7 } as JxlEncodeOptions;
    } else {
      slowOptions = {
        quality: optimalQ,
        progressive: true,
        optimizeCoding: true,
        trellisMultipass: true,
        trellisOptZero: true,
        trellisOptTable: true,
        autoSubsample: true,
      } as JpegEncodeOptions;
    }

    const finalBuffer = await codec.encode(inputImage, slowOptions);
    const finalDecoded = await codec.decode(finalBuffer);
    const finalScore = computePerceptualScore(inputImage, finalDecoded);
    const isBitExact = verifyBitExact(inputImage, finalDecoded);
    const durationMs = Math.round(performance.now() - startTime);

    return ok({
      outputBuffer: finalBuffer,
      format: plan.targetFormat,
      qualityScore: finalScore,
      qualityParam: optimalQ,
      iterations,
      isLosslessBitExact: isBitExact,
      durationMs,
    });
  } catch (error) {
    return err({
      code: 'ENCODE_ERROR',
      message: `Failed during search and encode to ${plan.targetFormat.toUpperCase()}.`,
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
