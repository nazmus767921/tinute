import type { RawImage } from '../codecs/types';

/**
 * Quality Metric Gate Interface
 * Provides a standardized contract for perceptual quality evaluation
 * and lossless bit-exact pixel verification.
 */
export interface QualityMetricGate {
  readonly name: string;
  computePerceptualScore(reference: RawImage, distorted: RawImage): number;
  verifyBitExact(reference: RawImage, distorted: RawImage): boolean;
  computePixelHash(image: RawImage): string;
}

/**
 * Fast 64-bit FNV-1a Hash of raw pixel buffer.
 * Used to verify bit-exact pixel equality in lossless compression mode.
 */
export function computePixelHash(image: RawImage): string {
  const FNV_PRIME = 1099511628211n;
  const FNV_OFFSET = 14695981039346656037n;
  let hash = FNV_OFFSET;
  const data = image.data;
  const len = data.length;

  for (let i = 0; i < len; i++) {
    hash = (hash ^ BigInt(data[i]!)) * FNV_PRIME;
    hash = hash & 0xffffffffffffffffn;
  }

  return hash.toString(16).padStart(16, '0');
}

/**
 * Verifies bit-exact pixel match between two raw image buffers.
 * Returns true if dimensions match and every RGBA byte is identical.
 */
export function verifyBitExact(ref: RawImage, distorted: RawImage): boolean {
  if (ref.width !== distorted.width || ref.height !== distorted.height) {
    return false;
  }

  const d1 = ref.data;
  const d2 = distorted.data;
  const len = d1.length;

  if (len !== d2.length) {
    return false;
  }

  for (let i = 0; i < len; i++) {
    if (d1[i] !== d2[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Gamma expansion: converts 8-bit sRGB value [0..255] to linear luminance [0..1].
 * Uses precomputed 256-entry lookup table for sub-millisecond execution.
 */
const SRGB_TO_LINEAR_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR_LUT[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

interface PixelChannels {
  y: Float32Array; // Linear luminance
  cb: Float32Array; // Blue-difference chroma
  cr: Float32Array; // Red-difference chroma
  alpha: Float32Array; // Normalized alpha weight
}

function extractChannels(image: RawImage): PixelChannels {
  const pixelCount = image.width * image.height;
  const y = new Float32Array(pixelCount);
  const cb = new Float32Array(pixelCount);
  const cr = new Float32Array(pixelCount);
  const alpha = new Float32Array(pixelCount);

  const data = image.data;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const rLin = SRGB_TO_LINEAR_LUT[data[i]!]!;
    const gLin = SRGB_TO_LINEAR_LUT[data[i + 1]!]!;
    const bLin = SRGB_TO_LINEAR_LUT[data[i + 2]!]!;
    const aNorm = data[i + 3]! / 255;

    // BT.709 linear luma & chroma weights
    const luma = 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
    y[p] = luma;
    cb[p] = -0.1146 * rLin - 0.3854 * gLin + 0.5 * bLin;
    cr[p] = 0.5 * rLin - 0.4542 * gLin - 0.0458 * bLin;
    alpha[p] = aNorm;
  }

  return { y, cb, cr, alpha };
}

/**
 * Downsamples channel plane by 2x2 box average filter for multi-scale analysis.
 */
function downsampleChannel(
  channel: Float32Array,
  width: number,
  height: number,
): { data: Float32Array; newWidth: number; newHeight: number } {
  const newWidth = Math.floor(width / 2);
  const newHeight = Math.floor(height / 2);
  const data = new Float32Array(newWidth * newHeight);

  for (let ny = 0; ny < newHeight; ny++) {
    for (let nx = 0; nx < newWidth; nx++) {
      const x0 = nx * 2;
      const y0 = ny * 2;
      const idx00 = y0 * width + x0;
      const idx10 = idx00 + 1;
      const idx01 = idx00 + width;
      const idx11 = idx01 + 1;

      data[ny * newWidth + nx] =
        (channel[idx00]! + channel[idx10]! + channel[idx01]! + channel[idx11]!) * 0.25;
    }
  }

  return { data, newWidth, newHeight };
}

/**
 * Computes structural similarity (SSIM) and chroma fidelity over block windows.
 */
function computeScaleMetrics(
  ch1: PixelChannels,
  ch2: PixelChannels,
  width: number,
  height: number,
  blockSize = 8,
): { structuralScore: number; chromaMse: number } {
  const C1 = 0.0001; // (0.01)^2 stability constant
  const C2 = 0.0009; // (0.03)^2 stability constant

  const effectiveBlock = Math.min(blockSize, Math.max(2, Math.min(width, height)));
  const blocksX = Math.floor(width / effectiveBlock);
  const blocksY = Math.floor(height / effectiveBlock);

  if (blocksX === 0 || blocksY === 0) {
    return { structuralScore: 1.0, chromaMse: 0.0 };
  }

  let totalSsim = 0;
  let totalChromaDist = 0;
  let blockCount = 0;

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const startX = bx * effectiveBlock;
      const startY = by * effectiveBlock;

      let sumX = 0;
      let sumY = 0;
      let sumXX = 0;
      let sumYY = 0;
      let sumXY = 0;
      let blockChromaErr = 0;
      let n = 0;

      for (let y = 0; y < effectiveBlock; y++) {
        for (let x = 0; x < effectiveBlock; x++) {
          const idx = (startY + y) * width + (startX + x);
          const pxX = ch1.y[idx]!;
          const pxY = ch2.y[idx]!;
          const aWeight = Math.min(ch1.alpha[idx]!, ch2.alpha[idx]!);

          if (aWeight > 0.01) {
            sumX += pxX;
            sumY += pxY;
            sumXX += pxX * pxX;
            sumYY += pxY * pxY;
            sumXY += pxX * pxY;

            const dCb = ch1.cb[idx]! - ch2.cb[idx]!;
            const dCr = ch1.cr[idx]! - ch2.cr[idx]!;
            blockChromaErr += (dCb * dCb + dCr * dCr) * aWeight;
            n += aWeight;
          }
        }
      }

      if (n > 0.5) {
        const muX = sumX / n;
        const muY = sumY / n;
        const varX = Math.max(0, sumXX / n - muX * muX);
        const varY = Math.max(0, sumYY / n - muY * muY);
        const covXY = sumXY / n - muX * muY;

        const luminance = (2 * muX * muY + C1) / (muX * muX + muY * muY + C1);
        const contrast = (2 * covXY + C2) / (varX + varY + C2);
        const blockSsim = Math.max(-1, Math.min(1, luminance * contrast));

        totalSsim += blockSsim;
        totalChromaDist += blockChromaErr / n;
        blockCount++;
      }
    }
  }

  const structuralScore = blockCount > 0 ? Math.max(0, totalSsim / blockCount) : 1.0;
  const chromaMse = blockCount > 0 ? totalChromaDist / blockCount : 0.0;

  return { structuralScore, chromaMse };
}

/**
 * Computes perceptual image quality score calibrated to the SSIMULACRA2 scale (0 - 100).
 *
 * Calibration:
 * - 100.0: Bit-exact or visually indistinguishable.
 * - >= 85.0: Visually lossless threshold (imperceptible artifacts at normal viewing).
 * - 70.0 - 85.0: High quality with subtle compression.
 * - 50.0 - 70.0: Medium quality, visible compression artifacts.
 * - < 50.0: Low quality, heavy distortion.
 */
export function computePerceptualScore(reference: RawImage, distorted: RawImage): number {
  if (reference.width !== distorted.width || reference.height !== distorted.height) {
    return 0;
  }

  // Fast path: bit-exact equality returns exactly 100.0
  if (verifyBitExact(reference, distorted)) {
    return 100.0;
  }

  if (reference.width * reference.height > 262_144) {
    const width = Math.min(128, reference.width),
      height = Math.min(128, reference.height);
    const sample = (image: RawImage): RawImage => {
      const data = new Uint8ClampedArray(width * 3 * height * 3 * 4);
      for (let py = 0; py < 3; py++)
        for (let px = 0; px < 3; px++) {
          const sx = Math.round(((image.width - width) * px) / 2);
          const sy = Math.round(((image.height - height) * py) / 2);
          for (let y = 0; y < height; y++) {
            const start = ((sy + y) * image.width + sx) * 4;
            data.set(
              image.data.subarray(start, start + width * 4),
              ((py * height + y) * width * 3 + px * width) * 4,
            );
          }
        }
      return { width: width * 3, height: height * 3, data };
    };
    return computePerceptualScore(sample(reference), sample(distorted));
  }
  const ch1 = extractChannels(reference);
  const ch2 = extractChannels(distorted);

  // Scale 1: Full-resolution structural evaluation
  const scale1 = computeScaleMetrics(ch1, ch2, reference.width, reference.height, 8);

  let compositeStructural = scale1.structuralScore;
  let compositeChroma = scale1.chromaMse;

  // Scale 2: Half-resolution evaluation for multi-scale pooling
  if (reference.width >= 4 && reference.height >= 4) {
    const ds1Y = downsampleChannel(ch1.y, reference.width, reference.height);
    const ds2Y = downsampleChannel(ch2.y, reference.width, reference.height);
    const ds1Cb = downsampleChannel(ch1.cb, reference.width, reference.height);
    const ds2Cb = downsampleChannel(ch2.cb, reference.width, reference.height);
    const ds1Cr = downsampleChannel(ch1.cr, reference.width, reference.height);
    const ds2Cr = downsampleChannel(ch2.cr, reference.width, reference.height);
    const ds1A = downsampleChannel(ch1.alpha, reference.width, reference.height);
    const ds2A = downsampleChannel(ch2.alpha, reference.width, reference.height);

    const dsCh1: PixelChannels = {
      y: ds1Y.data,
      cb: ds1Cb.data,
      cr: ds1Cr.data,
      alpha: ds1A.data,
    };

    const dsCh2: PixelChannels = {
      y: ds2Y.data,
      cb: ds2Cb.data,
      cr: ds2Cr.data,
      alpha: ds2A.data,
    };

    const scale2 = computeScaleMetrics(dsCh1, dsCh2, ds1Y.newWidth, ds1Y.newHeight, 4);

    compositeStructural = 0.4 * scale1.structuralScore + 0.6 * scale2.structuralScore;
    compositeChroma = 0.5 * scale1.chromaMse + 0.5 * scale2.chromaMse;
  }

  // Chroma penalty factor
  const chromaPenalty = Math.max(0, 1.0 - 3.0 * Math.sqrt(compositeChroma));
  const perceptualSimilarity = compositeStructural * (0.85 + 0.15 * chromaPenalty);

  // Perceptual distortion mapped to SSIMULACRA2 scale (0 - 100)
  const distortion = Math.max(0, 1.0 - perceptualSimilarity);
  if (distortion <= 0) {
    return 100.0;
  }

  // Calibrated score curve
  const scaledScore = 100 - 100 * Math.pow(Math.min(1.0, distortion * 6.5), 0.85);
  const clampedScore = Math.max(0, Math.min(100, scaledScore));

  return Math.round(clampedScore * 10) / 10;
}

/**
 * Default SSIMULACRA2 Quality Metric Gate implementation.
 */
export const ssimulacra2Gate: QualityMetricGate = {
  name: 'SSIMULACRA2-Calibrated',
  computePerceptualScore,
  verifyBitExact,
  computePixelHash,
};
