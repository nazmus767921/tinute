import type { ImageJob } from '../store/pipelineStore';
import { retrieveFromDisk, retrieveBlob } from '../storage/opfs';
import { getMimeType } from './format';

export async function readJobBlob(job: ImageJob): Promise<Blob> {
  if (!job.result) throw new Error('Image is not ready.');
  const type = getMimeType(job.result.outputFormat);
  if (job.result.outputBuffer.byteLength) return new Blob([job.result.outputBuffer], { type });
  const blob = await retrieveBlob(job.result.spillRef ?? job.resultStorageId ?? job.id);
  if (!blob?.size) throw new Error('Image output is unavailable. Process this image again.');
  return blob.slice(0, blob.size, type);
}

/** Output stays on disk after processing and is read only for preview/export. */
export async function readJobOutput(job: ImageJob): Promise<ArrayBuffer> {
  if (!job.result) throw new Error('Image is not ready.');
  if (job.result.outputBuffer.byteLength) return job.result.outputBuffer;
  const buffer = await retrieveFromDisk(job.result.spillRef ?? job.resultStorageId ?? job.id);
  if (!buffer?.byteLength)
    throw new Error('Image output is unavailable. Process this image again.');
  return buffer;
}
