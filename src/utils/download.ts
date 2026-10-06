import { readJobBlob } from './output';
import type { ImageJob } from '../store/pipelineStore';
import { getOutputExtension } from './format';
import { triggerFileDownload } from './zipExport';

export async function downloadImageJob(job: ImageJob): Promise<void> {
  if (job.status !== 'done' || !job.result) throw new Error('Image is not ready.');
  triggerFileDownload(
    await readJobBlob(job),
    `${job.name.replace(/\.[^/.]+$/, '')}.optimized.${getOutputExtension(job.name, job.result.outputFormat)}`,
  );
}
