import { processingAdmission } from '../workers/admission';
import { estimateJobMemory } from '../workers/inspect';
import type { WorkerPool } from '../workers/WorkerPool';
import type { ImageJob } from './pipelineStore';
import type { UserPipelineSettings, FinalPipelineOutput, PipelineError } from '../pipeline/types';
import { spillToDisk, removeSpill } from '../storage/opfs';

export const MAX_FILES_PER_BATCH = 100;
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  inFlight: number;
  isProcessing: boolean;
}

export type JobUpdateCallback = (id: string, updates: Partial<ImageJob>) => void;

/**
 * Orchestrates batch execution with bounded worker concurrency and OPFS spillover.
 */
export async function runBatchOrchestrator(
  pool: WorkerPool,
  jobs: ImageJob[],
  settings: UserPipelineSettings,
  onJobUpdate: JobUpdateCallback,
  onAnnouncement?: (msg: string) => void,
  isCancelled: (id: string) => boolean = () => false,
  getStorageId: (id: string) => string = (id) => id,
): Promise<void> {
  const queuedJobs = jobs.filter((j) => j.status === 'queued');
  if (queuedJobs.length === 0) return;

  const concurrency = Math.max(1, pool.size);
  let queueIndex = 0;
  let activeWorkers = 0;

  return new Promise<void>((resolve) => {
    const launchNext = () => {
      // Check if all jobs have completed or been launched
      if (queueIndex >= queuedJobs.length && activeWorkers === 0) {
        resolve();
        return;
      }

      // Launch jobs up to concurrency limit
      while (activeWorkers < concurrency && queueIndex < queuedJobs.length) {
        const job = queuedJobs[queueIndex++];
        if (!job) break;
        if (isCancelled(job.id)) continue;

        // Enforce individual 50MB limit
        if (job.originalSize > MAX_FILE_SIZE_BYTES) {
          const err: PipelineError = {
            code: 'FILE_TOO_LARGE',
            message: `File exceeds 50MB limit (${(job.originalSize / (1024 * 1024)).toFixed(1)}MB).`,
          };
          onJobUpdate(job.id, { status: 'error', error: err });
          onAnnouncement?.(`File ${job.name} exceeds 50MB limit.`);
          continue;
        }

        activeWorkers++;

        (async () => {
          let release: (() => void) | null = null;
          try {
            // Conservative reservation before reading: unknown headers never admit parallel heaps.
            const estimate = await estimateJobMemory(job.file, settings);
            if (isCancelled(job.id)) return;
            release = await processingAdmission.acquire(job.id, estimate);
            if (!release || isCancelled(job.id)) return;
            onJobUpdate(job.id, { status: 'processing' });
            onAnnouncement?.(`Processing ${job.name}...`);
            // Read buffer just-in-time to conserve heap memory
            const buffer = await job.file.arrayBuffer();
            if (isCancelled(job.id)) return;
            const result = await pool.submit({ id: job.id, buffer, settings });
            release();
            release = null;

            if (isCancelled(job.id)) return;
            if (result.ok) {
              const resValue: FinalPipelineOutput = result.value;
              // Spill output buffer to OPFS to free main-thread memory
              const resultStorageId = getStorageId(job.id);
              await spillToDisk(resultStorageId, resValue.outputBuffer);
              if (isCancelled(job.id)) {
                await removeSpill(resultStorageId);
                return;
              }

              onJobUpdate(job.id, {
                status: 'done',
                result: {
                  ...resValue,
                  outputBuffer: new ArrayBuffer(0),
                  spillRef: resultStorageId,
                },
                error: null,
                resultStorageId,
              });
              onAnnouncement?.(`Completed ${job.name}: -${resValue.savingsPercentage}%.`);
            } else {
              onJobUpdate(job.id, { status: 'error', error: result.error });
              onAnnouncement?.(`Error processing ${job.name}: ${result.error.message}`);
            }
          } catch (err) {
            if (isCancelled(job.id)) return;
            onJobUpdate(job.id, {
              status: 'error',
              error: { code: 'WORKER_CRASHED', message: String(err) },
            });
            onAnnouncement?.(`Crash processing ${job.name}.`);
          } finally {
            release?.();
            activeWorkers--;
            launchNext();
          }
        })();
      }
      if (queueIndex >= queuedJobs.length && activeWorkers === 0) resolve();
    };

    launchNext();
  });
}
