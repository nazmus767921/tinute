import * as Comlink from 'comlink';
import type { WorkerJobPayload, WorkerJobResult, WorkerRpcApi } from './types';
import { err } from '../pipeline/types';

export interface WorkerInstance {
  id: number;
  worker: Worker;
  proxy: Comlink.Remote<WorkerRpcApi>;
  isBusy: boolean;
  activeJobId: string | null;
}

export interface QueuedJob {
  payload: WorkerJobPayload;
  resolve: (result: WorkerJobResult) => void;
  reject: (error: unknown) => void;
}

export interface WorkerPoolConfig {
  maxWorkers?: number;
  workerFactory?: () => Worker;
}

export class WorkerPool {
  private workers: WorkerInstance[] = [];
  private queue: QueuedJob[] = [];
  private nextWorkerId = 1;
  private readonly poolSize: number;
  private readonly workerFactory: () => Worker;
  private isDestroyed = false;

  constructor(config: WorkerPoolConfig = {}) {
    this.workerFactory =
      config.workerFactory ??
      (() => new Worker(new URL('./pipeline.worker.ts', import.meta.url), { type: 'module' }));

    this.poolSize = config.maxWorkers ?? WorkerPool.determineOptimalPoolSize();
    this.initPool();
  }

  /**
   * Leave a CPU thread free and cap concurrent full-resolution codec heaps.
   */
  public static determineOptimalPoolSize(): number {
    if (typeof navigator === 'undefined') return 2;

    const concurrency = navigator.hardwareConcurrency || 4;
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);

    if (isMobile) {
      return Math.min(2, Math.max(1, concurrency - 1));
    }

    return Math.min(4, Math.max(1, concurrency - 1));
  }

  public get size(): number {
    return this.poolSize;
  }

  public get activeWorkersCount(): number {
    return this.workers.filter((w) => w.isBusy).length;
  }

  public get queuedJobsCount(): number {
    return this.queue.length;
  }

  private initPool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      this.spawnWorker();
    }
  }

  private spawnWorker(): WorkerInstance {
    const id = this.nextWorkerId++;
    const worker = this.workerFactory();

    const instance: WorkerInstance = {
      id,
      worker,
      proxy: Comlink.wrap<WorkerRpcApi>(worker),
      isBusy: false,
      activeJobId: null,
    };

    worker.onerror = (e) => {
      this.handleWorkerCrash(instance, e);
    };

    this.workers.push(instance);
    return instance;
  }

  private handleWorkerCrash(instance: WorkerInstance, errorEvent: ErrorEvent): void {
    const crashedJobId = instance.activeJobId;

    // Terminate and discard crashed worker
    try {
      instance.worker.terminate();
    } catch {
      // Ignore termination error
    }

    this.workers = this.workers.filter((w) => w.id !== instance.id);

    // If a job was actively running on this worker, reject it with fault isolation
    if (crashedJobId) {
      const activeJob = this.activeJobMap.get(crashedJobId);
      if (activeJob) {
        this.activeJobMap.delete(crashedJobId);
        activeJob.resolve(
          err({
            code: 'WORKER_CRASHED',
            message: `Worker crashed during image processing: ${errorEvent.message || 'Unknown error'}`,
          }),
        );
      }
    }

    // Respawn replacement worker unless the pool is shut down
    if (!this.isDestroyed) {
      this.spawnWorker();
      this.drainQueue();
    }
  }

  private activeJobMap = new Map<string, QueuedJob>();

  /**
   * Submits a job to the worker pool.
   * Image buffer is transferred via Transferable to prevent structured clone overhead.
   */
  public submit(payload: WorkerJobPayload): Promise<WorkerJobResult> {
    if (this.isDestroyed) {
      return Promise.resolve(
        err({
          code: 'WORKER_CRASHED',
          message: 'Worker pool has been destroyed.',
        }),
      );
    }

    return new Promise<WorkerJobResult>((resolve, reject) => {
      const job: QueuedJob = { payload, resolve, reject };
      this.queue.push(job);
      this.drainQueue();
    });
  }

  /**
   * Cancels a job: terminates the active worker immediately and respawns a clean replacement.
   */
  public cancel(jobId: string): boolean {
    // 1. If still queued, remove directly
    const queueIdx = this.queue.findIndex((j) => j.payload.id === jobId);
    if (queueIdx !== -1) {
      const [removed] = this.queue.splice(queueIdx, 1);
      if (removed) {
        removed.resolve(
          err({
            code: 'JOB_CANCELLED',
            message: `Job ${jobId} was cancelled before execution.`,
          }),
        );
      }
      return true;
    }

    // 2. If running on an active worker, terminate worker and respawn
    const busyWorker = this.workers.find((w) => w.activeJobId === jobId);
    if (busyWorker) {
      try {
        busyWorker.worker.terminate();
      } catch {
        // Ignore
      }

      this.workers = this.workers.filter((w) => w.id !== busyWorker.id);
      const activeJob = this.activeJobMap.get(jobId);
      if (activeJob) {
        this.activeJobMap.delete(jobId);
        activeJob.resolve(
          err({
            code: 'JOB_CANCELLED',
            message: `Job ${jobId} was cancelled during execution.`,
          }),
        );
      }

      if (!this.isDestroyed) {
        this.spawnWorker();
        this.drainQueue();
      }
      return true;
    }

    return false;
  }

  private drainQueue(): void {
    if (this.isDestroyed || this.queue.length === 0) return;

    const availableWorker = this.workers.find((w) => !w.isBusy);
    if (!availableWorker) return;

    const job = this.queue.shift();
    if (!job) return;

    availableWorker.isBusy = true;
    availableWorker.activeJobId = job.payload.id;
    this.activeJobMap.set(job.payload.id, job);

    (async () => {
      try {
        // Zero-copy pixel buffer transfer to worker
        const transferPayload = Comlink.transfer(job.payload, [job.payload.buffer]);
        const result = await availableWorker.proxy.processJob(transferPayload);
        this.activeJobMap.delete(job.payload.id);
        availableWorker.isBusy = false;
        availableWorker.activeJobId = null;
        job.resolve(result);
      } catch (error) {
        this.activeJobMap.delete(job.payload.id);
        availableWorker.isBusy = false;
        availableWorker.activeJobId = null;
        job.resolve(
          err({
            code: 'WORKER_CRASHED',
            message: 'Worker execution failure.',
            details: error instanceof Error ? error.message : String(error),
          }),
        );
      } finally {
        this.drainQueue();
      }
    })();
  }

  public destroy(): void {
    this.isDestroyed = true;
    for (const job of this.queue) {
      job.resolve(
        err({
          code: 'JOB_CANCELLED',
          message: 'Worker pool shut down.',
        }),
      );
    }
    this.queue = [];

    for (const w of this.workers) {
      try {
        w.worker.terminate();
      } catch {
        // Ignore
      }
    }
    this.workers = [];
    this.activeJobMap.clear();
  }
}
