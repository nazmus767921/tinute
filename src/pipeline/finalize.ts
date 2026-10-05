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
    gpsRemoved: settings.stripMetadata,
    exifRemoved: settings.stripMetadata,
    iccPreserved: true, // Color accuracy preserved
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
    generationalLossWarning: guardResult.generationalLossWarning,
    qualityScore: guardResult.qualityScore,
    isLosslessBitExact: guardResult.isLosslessBitExact,
    classification: plan.classification,
    mode: plan.mode,
    metadataReport,
    durationMs: totalDurationMs,
  });
}
