import { readJobOutput } from './output';
import type { ImageJob } from '../store/pipelineStore';
import { getFileExtension, getMimeType } from './format';
import { triggerFileDownload } from './zipExport';

export async function downloadImageJob(job: ImageJob): Promise<void> {
  if (job.status !== 'done' || !job.result) throw new Error('Image is not ready.');
  triggerFileDownload(
    new Blob([await readJobOutput(job)], { type: getMimeType(job.result.outputFormat) }),
    `${job.name.replace(/\.[^/.]+$/, '')}.optimized.${getFileExtension(job.result.outputFormat)}`,
  );
}
