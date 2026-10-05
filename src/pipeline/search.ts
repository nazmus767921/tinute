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

/** Nine original-resolution patches retain texture/detail that resizing would smooth away. */
function createSearchSample(image: RawImage): RawImage {
  const patchWidth = Math.min(128, image.width);
  const patchHeight = Math.min(128, image.height);
  const width = patchWidth * 3;
  const height = patchHeight * 3;
  if (image.width * image.height <= width * height) return image;

  const data = new Uint8ClampedArray(width * height * 4);
  for (let py = 0; py < 3; py++) {
    const sourceY = Math.round(((image.height - patchHeight) * py) / 2);
    for (let px = 0; px < 3; px++) {
      const sourceX = Math.round(((image.width - patchWidth) * px) / 2);
      for (let y = 0; y < patchHeight; y++) {
        const start = ((sourceY + y) * image.width + sourceX) * 4;
        const destination = ((py * patchHeight + y) * width + px * patchWidth) * 4;
        data.set(image.data.subarray(start, start + patchWidth * 4), destination);
      }
    }
  }
  return { width, height, data };
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
 * - Binary search on original-resolution sample patches (at most 147,456 pixels).
 * - Fast encoder speed during search iterations.
 * - One final encode at the SLOW high-efficiency setting for maximal compression density.
 * - Verifies the full-resolution output and increases quality if the sample was optimistic.
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
    const searchImage = createSearchSample(inputImage);
    let low = config.minQuality;
    let high = config.maxQuality;
    const targetIterations = Math.max(config.minIterations, Math.min(6, config.maxIterations));

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

      const trialBuffer = await codec.encode(searchImage, fastOptions);
      const trialDecoded = await codec.decode(trialBuffer);
      const trialScore = computePerceptualScore(searchImage, trialDecoded);

      if (trialScore >= threshold) {
        bestPassed = { q: trialQ, score: trialScore };
        high = trialQ - 1;
      } else {
        low = trialQ + 1;
      }
    }

    let optimalQ = bestPassed ? bestPassed.q : Math.min(config.maxQuality, Math.max(low, high, 80));

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

    let finalBuffer = await codec.encode(inputImage, slowOptions);
    let finalDecoded = await codec.decode(finalBuffer);
    let finalScore = computePerceptualScore(inputImage, finalDecoded);
    // Sample/encoder differences must never silently lower the requested quality.
    // Bound corrective full-image work to two retries; the last uses maximum quality.
    for (
      let retry = 0;
      finalScore < threshold && optimalQ < config.maxQuality && retry < 2;
      retry++
    ) {
      optimalQ =
        retry === 0
          ? Math.min(
              config.maxQuality,
              optimalQ + Math.max(5, Math.ceil((config.maxQuality - optimalQ) / 2)),
            )
          : config.maxQuality;
      finalBuffer = await codec.encode(inputImage, { ...slowOptions, quality: optimalQ });
      finalDecoded = await codec.decode(finalBuffer);
      finalScore = computePerceptualScore(inputImage, finalDecoded);
    }
    // Fine colored edges can fail the threshold even at maximum lossy quality
    // because of chroma subsampling. WebP can preserve these pixels losslessly.
    if (finalScore < threshold && plan.targetFormat === 'webp') {
      const losslessOptions: WebpEncodeOptions = { lossless: true, quality: 100, method: 4 };
      finalBuffer = await codec.encode(inputImage, losslessOptions);
      finalDecoded = await codec.decode(finalBuffer);
      finalScore = computePerceptualScore(inputImage, finalDecoded);
      optimalQ = 100;
    }
    if (finalScore < threshold) {
      return err({
        code: 'ENCODE_ERROR',
        message:
          'Could not meet the requested image quality. Try lossless mode or a different output format.',
        details: `Verified score ${finalScore}; requested ${threshold}.`,
      });
    }
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
