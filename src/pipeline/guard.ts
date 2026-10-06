import {
  ok,
  type Result,
  type EncodeResult,
  type GuardResult,
  type PipelineError,
  type ImageFormat,
} from './types';

/**
 * Guard Stage: Enforces the Never-Bigger Rule.
 *
 * Never-Bigger Rule:
 * If output size >= original size, return the original buffer with neverBiggerTriggered: true.
 * Quality score is 100.0 when the untouched original is retained.
 */
export function guardOptimization(
  originalBuffer: ArrayBuffer,
  encoded: EncodeResult,
  inputFormat: ImageFormat,
  options: { fallbackBuffer?: ArrayBuffer | null } = {},
): Result<GuardResult, PipelineError> {
  const originalSize = originalBuffer.byteLength;
  const encodedSize = encoded.outputBuffer.byteLength;

  const fallback = options.fallbackBuffer === undefined ? originalBuffer : options.fallbackBuffer;
  // Privacy and requested transforms take precedence over reverting to unsafe/unmodified input.
  if (fallback && encodedSize >= fallback.byteLength) {
    const savedBytes = originalSize - fallback.byteLength;
    return ok({
      outputBuffer: fallback,
      format: inputFormat,
      originalSize,
      finalSize: fallback.byteLength,
      savedBytes,
      savingsPercentage: Math.round((savedBytes / originalSize) * 100),
      metadataSanitized: fallback !== originalBuffer,
      neverBiggerTriggered: true,
      qualityScore: 100.0,
      isLosslessBitExact: true,
    });
  }

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
    qualityScore: encoded.qualityScore ?? 0,
    qualityVerified: encoded.qualityVerified,
    isLosslessBitExact: encoded.isLosslessBitExact ?? false,
  });
}
