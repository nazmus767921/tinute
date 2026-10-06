import type { RawImage, CodecEncodeOptions } from '../codecs/types';

/**
 * Functional Result Pattern
 * Pipeline stages NEVER throw across worker or module boundaries.
 */
export type Result<T, E = PipelineError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export type PipelineErrorCode =
  | 'FILE_TOO_LARGE'
  | 'INVALID_MAGIC_BYTES'
  | 'UNSUPPORTED_FORMAT'
  | 'DECOMPRESSION_BOMB_LIMIT_EXCEEDED'
  | 'DECODE_ERROR'
  | 'NORMALIZATION_ERROR'
  | 'CLASSIFICATION_ERROR'
  | 'PLANNING_ERROR'
  | 'ENCODE_ERROR'
  | 'GUARD_ERROR'
  | 'FINALIZE_ERROR'
  | 'WORKER_CRASHED'
  | 'JOB_CANCELLED';

export interface PipelineError {
  code: PipelineErrorCode;
  message: string;
  details?: string;
}

export type ImageFormat =
  'jpeg' | 'png' | 'webp' | 'avif' | 'jxl' | 'gif' | 'heic' | 'tiff' | 'bmp' | 'svg';

export type EncodableFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'jxl' | 'gif' | 'tiff' | 'bmp';
export type TargetFormat = 'preserve' | 'auto' | EncodableFormat;
export type OptimizationMode = 'lossless' | 'visually-lossless';
export type ImageClassification = 'photo' | 'screenshot' | 'illustration' | 'line-art';

export interface PipelineLimits {
  maxFileSizeBytes: number; // default 50 MB
  maxPixelCount: number; // default 100 Megapixels
}

export const DEFAULT_PIPELINE_LIMITS: PipelineLimits = {
  maxFileSizeBytes: 50 * 1024 * 1024, // 50 MB
  maxPixelCount: 100_000_000, // 100 Megapixels
};

export interface UserPipelineSettings {
  targetFormat: TargetFormat;
  mode: OptimizationMode;
  stripMetadata: boolean;
  qualityTarget?: number; // 1-100 (for visually lossless / manual)
  maxDimension?: number; // optional resize limit (e.g. 1920, 2560, 3840)
  limits?: Partial<PipelineLimits>;
}

export interface SniffResult {
  format: ImageFormat;
  byteLength: number;
}

export interface MetadataBundle {
  orientation?: number | undefined;
  hasAlpha: boolean;
  colorSpace?: string | undefined;
  iccProfileName?: string | undefined;
  rawIccBytes?: Uint8Array | undefined;
  hasGps?: boolean | undefined;
  deviceMake?: string | undefined;
  deviceModel?: string | undefined;
  isAnimated?: boolean | undefined;
  frameCount?: number | undefined;
  durationMs?: number | undefined;
  exifStripped?: boolean | undefined;
}

export interface DecodedImage {
  image: RawImage;
  format: ImageFormat;
  originalByteLength: number;
  metadata: MetadataBundle;
}

export interface NormalizedImage {
  image: RawImage;
  format: ImageFormat;
  originalByteLength: number;
  metadata: MetadataBundle;
}

export interface ClassificationResult {
  classification: ImageClassification;
  uniqueColorCountEstimate: number;
  edgeDensity: number;
  hasAlpha: boolean;
}

export interface PipelinePlan {
  targetFormat: ImageFormat;
  mode: OptimizationMode;
  encodeOptions: CodecEncodeOptions;
  candidateEncoders: ImageFormat[];
  classification: ImageClassification;
}

export interface EncodeResult {
  outputBuffer: ArrayBuffer;
  format: ImageFormat;
  qualityScore: number;
  qualityVerified?: boolean | undefined;
  qualityParam?: number;
  iterations?: number;
  isLosslessBitExact?: boolean;
  durationMs: number;
}

export interface GuardResult {
  outputBuffer: ArrayBuffer;
  format: ImageFormat;
  originalSize: number;
  finalSize: number;
  savedBytes: number;
  savingsPercentage: number;
  neverBiggerTriggered: boolean;
  metadataSanitized?: boolean;
  generationalLossWarning: boolean;
  qualityScore: number;
  qualityVerified?: boolean | undefined;
  isLosslessBitExact: boolean;
}

export interface StrippedMetadataReport {
  gpsRemoved: boolean;
  exifRemoved: boolean;
  iccPreserved: boolean;
}

export interface FinalPipelineOutput {
  id: string;
  outputBuffer: ArrayBuffer;
  outputFormat: ImageFormat;
  originalFormat: ImageFormat;
  originalSize: number;
  finalSize: number;
  savedBytes: number;
  savingsPercentage: number;
  neverBiggerTriggered: boolean;
  metadataSanitized?: boolean;
  generationalLossWarning: boolean;
  qualityScore: number;
  qualityVerified?: boolean | undefined;
  isLosslessBitExact: boolean;
  classification: ImageClassification;
  mode: OptimizationMode;
  metadataReport: StrippedMetadataReport;
  durationMs: number;
  spillRef?: string;
}
