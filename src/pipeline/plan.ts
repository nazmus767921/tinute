import {
  ok,
  type Result,
  type ClassificationResult,
  type UserPipelineSettings,
  type PipelinePlan,
  type PipelineError,
  type ImageFormat,
  type EncodableFormat,
} from './types';
import type { CodecEncodeOptions } from '../codecs/types';

/**
 * Plans the optimal encoder and parameter range based on image classification,
 * transparency, and user settings (Auto vs. Manual, Lossless vs. Visually Lossless).
 */
export function planOptimization(
  classification: ClassificationResult,
  settings: UserPipelineSettings,
): Result<PipelinePlan, PipelineError> {
  const { mode, targetFormat: requestedTarget, qualityTarget } = settings;
  const { hasAlpha, classification: category } = classification;

  let targetFormat: EncodableFormat;

  if (requestedTarget !== 'auto') {
    targetFormat = requestedTarget;
  } else {
    // Intelligent Auto selection based on content classification and alpha
    if (hasAlpha) {
      targetFormat = mode === 'lossless' ? 'png' : 'webp';
    } else if (category === 'screenshot' || category === 'line-art') {
      targetFormat = mode === 'lossless' ? 'png' : 'webp';
    } else {
      // Photo / illustration
      targetFormat = mode === 'lossless' ? 'webp' : 'webp';
    }
  }

  let encodeOptions: CodecEncodeOptions = {};

  if (mode === 'lossless') {
    switch (targetFormat) {
      case 'png':
        encodeOptions = { level: 2, optimiseAlpha: true, interlace: false };
        break;
      case 'webp':
        encodeOptions = { lossless: true, quality: 100, method: 4 };
        break;
      case 'avif':
        encodeOptions = { lossless: true, quality: 100, speed: 6 };
        break;
      case 'jxl':
        encodeOptions = { lossless: true, quality: 100, effort: 7 };
        break;
      case 'gif':
        encodeOptions = { paletteSize: 256 };
        break;
      case 'tiff':
        encodeOptions = { compression: true };
        break;
      case 'bmp':
        encodeOptions = { bitCount: hasAlpha ? 32 : 24 };
        break;
      case 'jpeg':
      default:
        encodeOptions = { quality: 95, progressive: true, optimizeCoding: true };
        break;
    }
  } else {
    // Visually lossless mode
    const defaultQuality =
      targetFormat === 'avif'
        ? 62
        : targetFormat === 'webp'
          ? 78
          : targetFormat === 'jxl'
            ? 75
            : 80;
    const baseQuality = qualityTarget ?? defaultQuality;

    switch (targetFormat) {
      case 'jpeg':
        encodeOptions = {
          quality: baseQuality,
          progressive: true,
          optimizeCoding: true,
          trellisMultipass: true,
          trellisOptZero: true,
        };
        break;
      case 'webp':
        encodeOptions = {
          quality: baseQuality,
          lossless: false,
          method: 4,
        };
        break;
      case 'avif':
        encodeOptions = {
          quality: baseQuality,
          lossless: false,
          speed: 6,
        };
        break;
      case 'jxl':
        encodeOptions = {
          quality: baseQuality,
          lossless: false,
          effort: 7,
        };
        break;
      case 'png':
        encodeOptions = {
          level: 3,
          optimiseAlpha: true,
        };
        break;
      case 'gif':
        encodeOptions = {
          paletteSize: 256,
        };
        break;
      case 'tiff':
      case 'bmp':
      default:
        encodeOptions = { bitCount: hasAlpha ? 32 : 24 };
        break;
    }
  }

  const candidateEncoders: ImageFormat[] = [targetFormat];

  return ok({
    targetFormat,
    mode,
    encodeOptions,
    candidateEncoders,
    classification: category,
  });
}
