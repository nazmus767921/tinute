import { extractExif } from './metadata/exif';
import {
  ok,
  type Result,
  type GuardResult,
  type PipelinePlan,
  type UserPipelineSettings,
  type FinalPipelineOutput,
  type PipelineError,
  type ImageFormat,
  type StrippedMetadataReport,
  type MetadataBundle,
} from './types';

/**
 * Finalize Stage:
 * Packages compression statistics, applies metadata stripping policies,
 * attaches quality scores, and generates the metadata report.
 */
export function finalizeOptimization(
  jobId: string,
  guardResult: GuardResult,
  plan: PipelinePlan,
  settings: UserPipelineSettings,
  originalFormat: ImageFormat,
  totalDurationMs: number,
  _metadata?: MetadataBundle,
): Result<FinalPipelineOutput, PipelineError> {
  const metadataReport: StrippedMetadataReport = {
    gpsRemoved:
      settings.stripMetadata &&
      (!guardResult.neverBiggerTriggered || !!guardResult.metadataSanitized),
    exifRemoved:
      extractExif(guardResult.outputBuffer).rawExifBytes === undefined &&
      settings.stripMetadata &&
      (!guardResult.neverBiggerTriggered || !!guardResult.metadataSanitized),
    iccPreserved: guardResult.neverBiggerTriggered, // Original ICC is retained only in the container fallback.
  };

  return ok({
    id: jobId,
    outputBuffer: guardResult.outputBuffer,
    outputFormat: guardResult.format,
    originalFormat,
    originalSize: guardResult.originalSize,
    finalSize: guardResult.finalSize,
    savedBytes: guardResult.savedBytes,
    savingsPercentage: guardResult.savingsPercentage,
    neverBiggerTriggered: guardResult.neverBiggerTriggered,
    metadataSanitized: !!guardResult.metadataSanitized,
    generationalLossWarning: guardResult.generationalLossWarning,
    qualityScore: guardResult.qualityScore,
    qualityVerified: guardResult.qualityVerified,
    isLosslessBitExact: guardResult.isLosslessBitExact,
    classification: plan.classification,
    mode: plan.mode,
    metadataReport,
    durationMs: totalDurationMs,
  });
}
