import { sniffImage } from '../pipeline/sniff';
import { inspectImageDimensions } from '../pipeline/metadata/dimensions';
import type { UserPipelineSettings } from '../pipeline/types';
import { PROCESSING_BUDGET_BYTES } from './admission';

/** Bounded header reads happen before the scheduler admits a full file read. */
export async function estimateJobMemory(
  file: File,
  settings: UserPipelineSettings,
): Promise<number> {
  const header = await file.slice(0, 65536).arrayBuffer();
  const detected = sniffImage(header);
  if (!detected.ok) return PROCESSING_BUDGET_BYTES;
  const dimensions = inspectImageDimensions(header, detected.value.format);
  if (!dimensions) return PROCESSING_BUDGET_BYTES;
  const source = detected.value.format;
  const target = settings.targetFormat === 'preserve' ? source : settings.targetFormat;
  const native =
    settings.mode !== 'lossless' &&
    ['jpeg', 'webp'].includes(target) &&
    ['jpeg', 'png', 'webp', 'avif', 'gif'].includes(source) &&
    typeof OffscreenCanvas !== 'undefined';
  const retained =
    target === source &&
    !settings.maxDimension &&
    ((source === 'jpeg' && settings.mode === 'lossless') ||
      ['heic', 'svg', 'tiff', 'bmp', 'gif'].includes(source));
  if (retained) return Math.max(64 * 1024 * 1024, file.size * 3);
  const compressedPng = source === 'png' && target === 'png' && !settings.maxDimension;
  const multiplier = native || compressedPng ? 12 : 24;
  return Math.max(
    64 * 1024 * 1024,
    dimensions.width * dimensions.height * multiplier + 32 * 1024 * 1024,
  );
}
