import type { ImageJob } from '../store/pipelineStore';
import { retrieveFromDisk } from '../storage/opfs';

/** Output stays on disk after processing and is read only for preview/export. */
export async function readJobOutput(job: ImageJob): Promise<ArrayBuffer> {
  if (!job.result) throw new Error('Image is not ready.');
  if (job.result.outputBuffer.byteLength) return job.result.outputBuffer;
  const buffer = await retrieveFromDisk(job.result.spillRef ?? job.resultStorageId ?? job.id);
  if (!buffer?.byteLength)
    throw new Error('Image output is unavailable. Process this image again.');
  return buffer;
}
