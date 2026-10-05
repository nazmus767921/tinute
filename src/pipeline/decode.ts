import { getCodec } from '../codecs';
import { gifCodec } from '../codecs/gifCodec';
import { inspectImageDimensions } from './metadata/dimensions';
import { extractExif } from './metadata/exif';
import { extractIccProfile } from './metadata/icc';
import {
  ok,
  err,
  type Result,
  type DecodedImage,
  type PipelineError,
  type ImageFormat,
  type PipelineLimits,
  type MetadataBundle,
  DEFAULT_PIPELINE_LIMITS,
} from './types';

/**
 * Decodes compressed image buffer to raw RGBA pixels and extracts rich metadata:
 * - EXIF Orientation, GPS, camera model
 * - ICC Profile and color space
 * - Alpha channel presence
 * - Animation frames / duration
 * - Enforces decompression-bomb defense (pixel count cap) immediately after decoding.
 */
export async function decodeImage(
  buffer: ArrayBuffer,
  format: ImageFormat,
  limits: PipelineLimits = DEFAULT_PIPELINE_LIMITS,
): Promise<Result<DecodedImage, PipelineError>> {
  const codec = getCodec(format);
  if (!codec) {
    return err({
      code: 'UNSUPPORTED_FORMAT',
      message: `No decoder registered for format: ${format}`,
    });
  }

  // Pre-decode decompression bomb check using container header metadata
  const headerDims = inspectImageDimensions(buffer, format);
  if (headerDims) {
    const headerPixelCount = headerDims.width * headerDims.height;
    if (headerPixelCount > limits.maxPixelCount) {
      const actualMp = (headerPixelCount / 1_000_000).toFixed(1);
      const maxMp = (limits.maxPixelCount / 1_000_000).toFixed(1);
      return err({
        code: 'DECOMPRESSION_BOMB_LIMIT_EXCEEDED',
        message: `Image dimensions (${headerDims.width}x${headerDims.height}, ${actualMp} MP) exceed maximum safety limit of ${maxMp} Megapixels. Pre-decode defense triggered.`,
      });
    }
  }

  try {
    const rawImage = await codec.decode(buffer);

    // Decompression Bomb Defense: Pixel Count Limit
    const pixelCount = rawImage.width * rawImage.height;
    if (pixelCount > limits.maxPixelCount) {
      const actualMp = (pixelCount / 1_000_000).toFixed(1);
      const maxMp = (limits.maxPixelCount / 1_000_000).toFixed(1);
      return err({
        code: 'DECOMPRESSION_BOMB_LIMIT_EXCEEDED',
        message: `Image dimensions (${rawImage.width}x${rawImage.height}, ${actualMp} MP) exceed maximum safety limit of ${maxMp} Megapixels.`,
      });
    }

    // Inspect alpha channel across pixels
    let hasAlpha = false;
    const data = rawImage.data;
    const step = Math.max(4, Math.floor(data.length / 4000) * 4);
    for (let i = 3; i < data.length; i += step) {
      if ((data[i] ?? 255) < 255) {
        hasAlpha = true;
        break;
      }
    }

    // Extract EXIF metadata (Orientation, GPS, Camera Info)
    const exif = extractExif(buffer);

    // Extract ICC Profile (Color Space)
    const icc = extractIccProfile(buffer);

    // Inspect Animation (GIF)
    let isAnimated = false;
    let frameCount = 1;
    let durationMs: number | undefined;

    if (format === 'gif') {
      try {
        const gifInfo = gifCodec.inspectGif(buffer);
        if (gifInfo.frameCount > 1) {
          isAnimated = true;
          frameCount = gifInfo.frameCount;
          durationMs = gifInfo.durationMs;
        }
      } catch {
        // Fallback for non-standard GIF structure
      }
    }

    const metadata: MetadataBundle = {
      orientation: exif.orientation,
      hasAlpha,
      colorSpace: icc?.colorSpace ?? 'srgb',
      iccProfileName: icc?.name,
      rawIccBytes: icc?.rawProfileBytes,
      hasGps: exif.hasGps,
      deviceMake: exif.make,
      deviceModel: exif.model,
      isAnimated,
      frameCount,
      durationMs,
    };

    return ok({
      image: rawImage,
      format,
      originalByteLength: buffer.byteLength,
      metadata,
    });
  } catch (error) {
    return err({
      code: 'DECODE_ERROR',
      message: `Failed to decode ${format.toUpperCase()} image.`,
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
