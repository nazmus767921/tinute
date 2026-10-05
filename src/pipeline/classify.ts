import {
  ok,
  type Result,
  type NormalizedImage,
  type ClassificationResult,
  type PipelineError,
  type ImageClassification,
} from './types';

/**
 * Fast content-aware classification using cheap heuristics:
 * - Color count estimation (sampling up to 2000 pixels)
 * - Edge density (Sobel/luminance difference)
 * - Alpha transparency
 */
export function classifyImage(
  normalized: NormalizedImage,
): Result<ClassificationResult, PipelineError> {
  const { data, width, height } = normalized.image;
  const totalPixels = width * height;
  const sampleTarget = Math.min(2000, totalPixels);
  const step = Math.max(1, Math.floor(totalPixels / sampleTarget));

  const sampledColors = new Set<number>();
  let totalEdgeDiff = 0;
  let edgeComparisons = 0;
  let hasAlpha = false;

  for (let p = 0; p < totalPixels; p += step) {
    const idx = p * 4;
    const r = data[idx] ?? 0;
    const g = data[idx + 1] ?? 0;
    const b = data[idx + 2] ?? 0;
    const a = data[idx + 3] ?? 255;

    if (a < 255) {
      hasAlpha = true;
    }

    // Quantize 8-bit to 5-bit per channel for compact fast color set (32k buckets)
    const colorKey = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    sampledColors.add(colorKey);

    // Fast horizontal gradient check (pixel with right neighbor)
    const x = p % width;
    if (x < width - 1) {
      const nextIdx = (p + 1) * 4;
      const nr = data[nextIdx] ?? 0;
      const ng = data[nextIdx + 1] ?? 0;
      const nb = data[nextIdx + 2] ?? 0;

      // Approximate perceptual luminance: 0.299R + 0.587G + 0.114B
      const l1 = 0.299 * r + 0.587 * g + 0.114 * b;
      const l2 = 0.299 * nr + 0.587 * ng + 0.114 * nb;
      totalEdgeDiff += Math.abs(l1 - l2);
      edgeComparisons++;
    }
  }

  const uniqueColorEstimate = sampledColors.size;
  const avgEdgeDensity = edgeComparisons > 0 ? totalEdgeDiff / edgeComparisons : 0;

  let classification: ImageClassification = 'photo';

  if (uniqueColorEstimate < 64 && avgEdgeDensity < 15) {
    classification = 'line-art';
  } else if (uniqueColorEstimate < 500 && avgEdgeDensity > 25) {
    classification = 'screenshot';
  } else if (uniqueColorEstimate < 800) {
    classification = 'illustration';
  } else {
    classification = 'photo';
  }

  return ok({
    classification,
    uniqueColorCountEstimate: uniqueColorEstimate,
    edgeDensity: avgEdgeDensity,
    hasAlpha,
  });
}
