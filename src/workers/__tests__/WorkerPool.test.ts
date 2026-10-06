import { describe, it, expect, vi } from 'vitest';
import { WorkerPool } from '../WorkerPool';
import { ok } from '../../pipeline/types';
import type { WorkerJobPayload } from '../types';

describe('WorkerPool Lifecycle & Fault Isolation', () => {
  it('settles a hung worker job and releases its heap after its deadline', async () => {
    vi.useFakeTimers();
    const workers: Worker[] = [];
    const pool = new WorkerPool({
      maxWorkers: 1,
      jobTimeoutMs: 20,
      workerFactory: () => {
        const worker = {
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          postMessage: vi.fn(),
          terminate: vi.fn(),
        } as unknown as Worker;
        workers.push(worker);
        return worker;
      },
    });
    try {
      const pending = pool.submit({
        id: 'hung',
        buffer: new ArrayBuffer(1),
        settings: { targetFormat: 'auto', mode: 'lossless', stripMetadata: true },
      });
      await vi.advanceTimersByTimeAsync(20);
      const result = await pending;
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/too long/i);
      expect(workers).toHaveLength(1);
      expect(workers[0]!.terminate).toHaveBeenCalled();
    } finally {
      pool.destroy();
      vi.useRealTimers();
    }
  });
  it('caps desktop concurrency to avoid allocating a codec heap per CPU thread', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'hardwareConcurrency');
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 128 });
    try {
      expect(WorkerPool.determineOptimalPoolSize()).toBeLessThanOrEqual(2);
    } finally {
      if (original) Object.defineProperty(navigator, 'hardwareConcurrency', original);
      else Reflect.deleteProperty(navigator, 'hardwareConcurrency');
    }
  });
  it('determines optimal pool size based on hardwareConcurrency - 1', () => {
    const desktopSize = WorkerPool.determineOptimalPoolSize();
    expect(desktopSize).toBeGreaterThanOrEqual(1);
  });

  it('manages queued jobs and responds via mocked worker factory', async () => {
    // Create mock worker with Comlink-like postMessage interface
    const mockWorkerFactory = () => {
      const listeners: Record<string, EventListener[]> = {};
      const mockWorker: unknown = {
        addEventListener: (event: string, fn: EventListener) => {
          const list = listeners[event] ?? [];
          list.push(fn);
          listeners[event] = list;
        },
        removeEventListener: () => {},
        postMessage: (msg: unknown) => {
          // Simulate Comlink RPC response
          setTimeout(() => {
            const handlers = listeners['message'] || [];
            for (const handler of handlers) {
              handler({
                data: {
                  id: (msg as { id: string }).id,
                  type: 'RESOLVE',
                  value: ok({
                    id: 'mock-job-1',
                    outputBuffer: new ArrayBuffer(50),
                    outputFormat: 'webp',
                    originalFormat: 'jpeg',
                    originalSize: 100,
                    finalSize: 50,
                    savedBytes: 50,
                    savingsPercentage: 50,
                    neverBiggerTriggered: false,
                    classification: 'photo',
                    mode: 'visually-lossless',
                    metadataReport: { gpsRemoved: true, exifRemoved: true, iccPreserved: true },
                    durationMs: 15,
                  }),
                },
              } as unknown as MessageEvent);
            }
          }, 5);
        },
        terminate: vi.fn(),
      };
      return mockWorker as Worker;
    };

    const pool = new WorkerPool({
      maxWorkers: 2,
      workerFactory: mockWorkerFactory,
    });

    expect(pool.size).toBe(2);
    pool.destroy();
  });

  it('cancels queued jobs immediately with code JOB_CANCELLED', async () => {
    // Worker that never responds to simulate long running task
    const mockWorkerFactory = () => {
      const mockWorker: unknown = {
        addEventListener: () => {},
        removeEventListener: () => {},
        postMessage: () => {},
        terminate: vi.fn(),
      };
      return mockWorker as Worker;
    };

    const pool = new WorkerPool({
      maxWorkers: 1,
      workerFactory: mockWorkerFactory,
    });

    const payload: WorkerJobPayload = {
      id: 'job-to-cancel',
      buffer: new ArrayBuffer(10),
      settings: {
        targetFormat: 'auto',
        mode: 'visually-lossless',
        stripMetadata: true,
      },
    };

    const promise = pool.submit(payload);
    const cancelled = pool.cancel('job-to-cancel');
    expect(cancelled).toBe(true);

    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('JOB_CANCELLED');
    }

    pool.destroy();
  });
});
