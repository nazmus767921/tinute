import { describe, it, expect, vi } from 'vitest';
import { runBatchOrchestrator, MAX_FILE_SIZE_BYTES } from '../batchOrchestrator';
import type { ImageJob } from '../pipelineStore';
import type { WorkerPool } from '../../workers/WorkerPool';
import { ok, err } from '../../pipeline/types';

describe('Batch Orchestrator', () => {
  it('rejects files larger than 50MB with clear error message without crashing batch', async () => {
    const oversizedFile = new File([], 'giant.jpg');
    Object.defineProperty(oversizedFile, 'size', { value: MAX_FILE_SIZE_BYTES + 1024 });

    const normalFile = new File([], 'normal.jpg');
    Object.defineProperty(normalFile, 'size', { value: 1024 * 1024 });
    normalFile.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(1024));

    const jobs: ImageJob[] = [
      {
        id: 'job-oversized',
        file: oversizedFile,
        name: 'giant.jpg',
        originalSize: MAX_FILE_SIZE_BYTES + 1024,
        status: 'queued',
        result: null,
        error: null,
      },
      {
        id: 'job-normal',
        file: normalFile,
        name: 'normal.jpg',
        originalSize: 1024 * 1024,
        status: 'queued',
        result: null,
        error: null,
      },
    ];

    const mockPool: Partial<WorkerPool> = {
      size: 2,
      submit: vi.fn().mockResolvedValue(
        ok({
          id: 'job-normal',
          outputBuffer: new ArrayBuffer(500),
          outputFormat: 'webp',
          originalFormat: 'jpeg',
          originalSize: 1024 * 1024,
          finalSize: 500,
          savedBytes: 524,
          savingsPercentage: 50,
          neverBiggerTriggered: false,
          generationalLossWarning: false,
          qualityScore: 85,
          isLosslessBitExact: false,
          classification: 'photo',
          mode: 'visually-lossless',
          metadataReport: { gpsRemoved: true, exifRemoved: true, iccPreserved: true },
          durationMs: 20,
        }),
      ),
    };

    const updates: Record<string, Partial<ImageJob>> = {};
    await runBatchOrchestrator(
      mockPool as WorkerPool,
      jobs,
      { targetFormat: 'auto', mode: 'visually-lossless', stripMetadata: true },
      (id, u) => {
        updates[id] = { ...updates[id], ...u };
      },
    );

    // Oversized job marked as error with FILE_TOO_LARGE
    expect(updates['job-oversized']?.status).toBe('error');
    expect(updates['job-oversized']?.error?.code).toBe('FILE_TOO_LARGE');
    expect(updates['job-oversized']?.error?.message).toContain('50MB limit');

    // Normal job completed successfully
    expect(updates['job-normal']?.status).toBe('done');
    expect(mockPool.submit).toHaveBeenCalledTimes(1);
  });

  it('isolates worker crashes to a single job and allows rest of batch to finish', async () => {
    const file1 = new File([], 'corrupt.jpg');
    file1.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(100));

    const file2 = new File([], 'valid.jpg');
    file2.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(100));

    const jobs: ImageJob[] = [
      {
        id: 'job-corrupt',
        file: file1,
        name: 'corrupt.jpg',
        originalSize: 100,
        status: 'queued',
        result: null,
        error: null,
      },
      {
        id: 'job-valid',
        file: file2,
        name: 'valid.jpg',
        originalSize: 100,
        status: 'queued',
        result: null,
        error: null,
      },
    ];

    const mockPool: Partial<WorkerPool> = {
      size: 2,
      submit: vi.fn().mockImplementation((payload) => {
        if (payload.id === 'job-corrupt') {
          return Promise.resolve(
            err({
              code: 'WORKER_CRASHED',
              message: 'Out of memory in codec thread.',
            }),
          );
        }
        return Promise.resolve(
          ok({
            id: 'job-valid',
            outputBuffer: new ArrayBuffer(50),
            outputFormat: 'webp',
            originalFormat: 'jpeg',
            originalSize: 100,
            finalSize: 50,
            savedBytes: 50,
            savingsPercentage: 50,
            neverBiggerTriggered: false,
            generationalLossWarning: false,
            qualityScore: 90,
            isLosslessBitExact: false,
            classification: 'photo',
            mode: 'visually-lossless',
            metadataReport: { gpsRemoved: true, exifRemoved: true, iccPreserved: true },
            durationMs: 10,
          }),
        );
      }),
    };

    const updates: Record<string, Partial<ImageJob>> = {};
    const announcements: string[] = [];

    await runBatchOrchestrator(
      mockPool as WorkerPool,
      jobs,
      { targetFormat: 'auto', mode: 'visually-lossless', stripMetadata: true },
      (id, u) => {
        updates[id] = { ...updates[id], ...u };
      },
      (msg) => announcements.push(msg),
    );

    // Corrupt job isolated to error
    expect(updates['job-corrupt']?.status).toBe('error');
    expect(updates['job-corrupt']?.error?.code).toBe('WORKER_CRASHED');

    // Valid job succeeded
    expect(updates['job-valid']?.status).toBe('done');
    expect(announcements.some((a) => a.includes('Completed valid.jpg'))).toBe(true);
  });
});
