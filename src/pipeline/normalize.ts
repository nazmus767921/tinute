import { normalizeOrientation } from './metadata/orientation';
import { normalizeColorSpace, inspectIccProfile } from './metadata/icc';
import { resizeRawImage } from './resize';
import {
  ok,
  err,
  type Result,
  type DecodedImage,
  type NormalizedImage,
  type PipelineError,
} from './types';

/**
 * Normalizes raw pixel data:
 * 1. Validates 8-bit RGBA channel layout.
 * 2. Applies EXIF orientation transformation to upright (Orientation 1).
 * 3. Normalizes wide-gamut ICC profiles (Display P3) to sRGB working color space.
 * 4. Preserves 8-bit alpha channel fidelity.
 */
export async function normalizeImage(
  decoded: DecodedImage,
  maxDimension?: number,
): Promise<Result<NormalizedImage, PipelineError>> {
  const { image, format, originalByteLength, metadata } = decoded;

  const expectedBytes = image.width * image.height * 4;
  if (image.data.byteLength !== expectedBytes) {
    return err({
      code: 'NORMALIZATION_ERROR',
      message: `Invalid raw buffer size. Expected ${expectedBytes} bytes for ${image.width}x${image.height} RGBA, got ${image.data.byteLength} bytes.`,
    });
  }

  // 1. EXIF Orientation Normalization
  let currentImage = image;
  const orientation = metadata.orientation ?? 1;
  if (orientation > 1) {
    currentImage = normalizeOrientation(currentImage, orientation);
  }

  // 2. ICC Color Space Normalization
  if (metadata.colorSpace !== 'srgb' && metadata.rawIccBytes) {
    const profile = inspectIccProfile(metadata.rawIccBytes);
    currentImage = await normalizeColorSpace(currentImage, profile);
  }

  // 3. Optional Resize by Max Dimension
  if (maxDimension && maxDimension > 0) {
    currentImage = resizeRawImage(currentImage, maxDimension);
  }

  // 3. Normalized metadata bundle (orientation is now normalized to standard top-left 1)
  const normalizedMetadata = {
    ...metadata,
    orientation: 1,
  };

  return ok({
    image: currentImage,
    format,
    originalByteLength,
    metadata: normalizedMetadata,
  });
}
