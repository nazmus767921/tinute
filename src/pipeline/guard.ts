import {
  ok,
  type Result,
  type EncodeResult,
  type GuardResult,
  type PipelineError,
  type ImageFormat,
  type OptimizationMode,
} from './types';

/**
 * Guard Stage: Enforces the Never-Bigger Rule and Generational Loss Warnings.
 *
 * Never-Bigger Rule:
 * If output size >= original size, return the original buffer with neverBiggerTriggered: true.
 * Quality score is 100.0 and bit-exact is true since the untouched original is retained.
 *
 * Generational Loss Warning:
 * If compressing lossy to lossy (e.g. JPEG to JPEG or JPEG to lossy WebP),
 * warn about compounded compression artifacts.
 */
export function guardOptimization(
  originalBuffer: ArrayBuffer,
  encoded: EncodeResult,
  inputFormat: ImageFormat,
  mode: OptimizationMode,
): Result<GuardResult, PipelineError> {
  const originalSize = originalBuffer.byteLength;
  const encodedSize = encoded.outputBuffer.byteLength;

  // 1. Never-Bigger Rule: Revert to original if output didn't shrink
  if (encodedSize >= originalSize) {
    return ok({
      outputBuffer: originalBuffer,
      format: inputFormat,
      originalSize,
      finalSize: originalSize,
      savedBytes: 0,
      savingsPercentage: 0,
      neverBiggerTriggered: true,
      generationalLossWarning: false,
      qualityScore: 100.0,
      isLosslessBitExact: true,
    });
  }

  // 2. Generational Loss Check
  const isInputLossy = inputFormat === 'jpeg';
  const isOutputLossy =
    mode === 'visually-lossless' &&
    (encoded.format === 'jpeg' ||
      encoded.format === 'webp' ||
      encoded.format === 'avif' ||
      encoded.format === 'jxl');
  const generationalLossWarning = isInputLossy && isOutputLossy;

  const savedBytes = originalSize - encodedSize;
  const savingsPercentage = Math.round((savedBytes / originalSize) * 100);

  return ok({
    outputBuffer: encoded.outputBuffer,
    format: encoded.format,
    originalSize,
    finalSize: encodedSize,
    savedBytes,
    savingsPercentage,
    neverBiggerTriggered: false,
    generationalLossWarning,
    qualityScore: encoded.qualityScore ?? 100.0,
    isLosslessBitExact: encoded.isLosslessBitExact ?? false,
  });
}
