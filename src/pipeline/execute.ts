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
} from './types';

/**
 * End-to-end Image Pipeline Executor.
 * Executes stages 1 through 8 sequentially with strict typed error propagation:
 * 1. Sniff (magic bytes, limits)
 * 2. Decode (to raw pixels + decompression bomb protection)
 * 3. Normalize (RGBA orientation & layout check)
 * 4. Classify (heuristics: colors, edge density, entropy)
 * 5. Plan (candidate encoders and parameter selection)
 * 6. Search (bounded sample quality search + full-resolution verified encode)
 * 7. Guard (never-bigger rule + generational loss warning)
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

  // 2. Decode (to raw pixels + decompression-bomb pixel limit)
  const decodeRes = await decodeImage(inputBuffer, originalFormat, limits);
  if (!decodeRes.ok) return decodeRes;

  // 3. Normalize (RGBA orientation & layout check + optional resize)
  const normRes = await normalizeImage(decodeRes.value, settings.maxDimension);
  if (!normRes.ok) return normRes;

  // 4. Classify (heuristics: colors, edge density, entropy)
  const classRes = classifyImage(normRes.value);
  if (!classRes.ok) return classRes;

  // 5. Plan (candidate encoders and parameter selection)
  const planRes = planOptimization(classRes.value, settings);
  if (!planRes.ok) return planRes;

  // 6. Search (sample patches, then verify the full-resolution output)
  const searchRes = await searchAndEncode(normRes.value, planRes.value, settings);
  if (!searchRes.ok) return searchRes;

  // 7. Guard (never-bigger rule + generational loss warning)
  const resized =
    normRes.value.image.width !== decodeRes.value.image.width ||
    normRes.value.image.height !== decodeRes.value.image.height;
  const fallbackBuffer = resized
    ? null
    : settings.stripMetadata
      ? sanitizeOriginalMetadata(inputBuffer, originalFormat)
      : inputBuffer;
  const guardRes = guardOptimization(inputBuffer, searchRes.value, originalFormat, settings.mode, {
    fallbackBuffer,
  });
  if (!guardRes.ok) return guardRes;

  if (guardRes.value.finalSize > limits.maxFileSizeBytes) {
    return err({
      code: 'ENCODE_ERROR',
      message:
        'The result exceeds the output size limit. Reduce image dimensions in Advanced settings and try again.',
    });
  }

  // 8. Finalize (metadata report and packaging)
  const totalDurationMs = Math.round(performance.now() - startTime);
  return finalizeOptimization(
    jobId,
    guardRes.value,
    planRes.value,
    settings,
    originalFormat,
    totalDurationMs,
    normRes.value.metadata,
  );
}
