import { getCodec } from '../codecs';
import { computePerceptualScore, verifyBitExact } from './qualityGate';
import {
  ok,
  err,
  type Result,
  type NormalizedImage,
  type PipelinePlan,
  type EncodeResult,
  type PipelineError,
} from './types';

/**
 * Executes planned image encoding using the selected WASM codec.
 * Pure function: side effects isolated to the codec boundary.
 */
export async function executeEncode(
  normalized: NormalizedImage,
  plan: PipelinePlan,
): Promise<Result<EncodeResult, PipelineError>> {
  const codec = getCodec(plan.targetFormat);
  if (!codec) {
    return err({
      code: 'UNSUPPORTED_FORMAT',
      message: `No encoder registered for target format: ${plan.targetFormat}`,
    });
  }

  const startTime = performance.now();

  try {
    const outputBuffer = await codec.encode(normalized.image, plan.encodeOptions);
    const decoded = await codec.decode(outputBuffer);
    const isBitExact = verifyBitExact(normalized.image, decoded);
    const qualityScore = isBitExact ? 100.0 : computePerceptualScore(normalized.image, decoded);
    const durationMs = Math.round(performance.now() - startTime);

    return ok({
      outputBuffer,
      format: plan.targetFormat,
      qualityScore,
      isLosslessBitExact: isBitExact,
      durationMs,
    });
  } catch (error) {
    return err({
      code: 'ENCODE_ERROR',
      message: `Failed to encode to ${plan.targetFormat.toUpperCase()}.`,
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
