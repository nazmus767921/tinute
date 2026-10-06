import { processingAdmission } from '../workers/admission';
import { create } from 'zustand';
import { WorkerPool } from '../workers/WorkerPool';
import type {
  UserPipelineSettings,
  FinalPipelineOutput,
  PipelineError,
  TargetFormat,
  OptimizationMode,
} from '../pipeline/types';
import { runBatchOrchestrator, MAX_FILES_PER_BATCH } from './batchOrchestrator';
import { exportBatchAsZip, triggerZipDownload } from '../utils/zipExport';
import { removeSpill } from '../storage/opfs';

export type JobStatus = 'queued' | 'processing' | 'done' | 'error' | 'cancelled';

export interface ImageJob {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  status: JobStatus;
  result: FinalPipelineOutput | null;
  error: PipelineError | null;
  resultStorageId?: string;
}

interface PipelineState {
  jobs: ImageJob[];
  settings: UserPipelineSettings;
  workerPool: WorkerPool | null;
  isProcessing: boolean;
  selectedCompareJobId: string | null;
  statusAnnouncement: string;
  isZipping: boolean;
  zipProgress: number;
  batchError: string | null;
  zipError: string | null;
  resetSettings: () => void;
  initPool: () => void;
  addFiles: (files: File[]) => Promise<void>;
  cancelJob: (id: string) => void;
  cancelAll: () => void;
  retryJob: (id: string) => Promise<void>;
  clearCompleted: () => void;
  exportZip: () => Promise<void>;
  setSelectedCompareJobId: (id: string | null) => void;
  setTargetFormat: (format: TargetFormat) => void;
  setMode: (mode: OptimizationMode) => void;
  setQualityTarget: (quality: number) => void;
  setStripMetadata: (strip: boolean) => void;
  setMaxDimension: (maxDimension?: number) => void;
}

export const MAX_BATCH_INPUT_BYTES = 100 * 1024 * 1024;

export const RECOMMENDED_SETTINGS: UserPipelineSettings = {
  targetFormat: 'preserve',
  mode: 'visually-lossless',
  stripMetadata: true,
  qualityTarget: 80,
};

const attempts = new Map<string, symbol>();
const hasPending = (jobs: ImageJob[]) =>
  jobs.some((j) => j.status === 'queued' || j.status === 'processing');

async function processSubmission(
  jobs: ImageJob[],
  get: () => PipelineState,
  set: (
    update: Partial<PipelineState> | ((state: PipelineState) => Partial<PipelineState>),
  ) => void,
) {
  const pool = get().workerPool;
  if (!pool) return;
  const token = Symbol('submission');
  const submissionId = crypto.randomUUID();
  jobs.forEach((j) => attempts.set(j.id, token));
  const settings = { ...get().settings };
  if (settings.limits) settings.limits = { ...settings.limits };
  const isCancelled = (id: string) =>
    attempts.get(id) !== token || !get().jobs.some((j) => j.id === id && j.status !== 'cancelled');
  await runBatchOrchestrator(
    pool,
    jobs,
    settings,
    (id, updates) => {
      if (isCancelled(id)) return;
      set((state) => {
        const nextJobs = state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j));
        return { jobs: nextJobs, isProcessing: hasPending(nextJobs) };
      });
    },
    (announcement) => set({ statusAnnouncement: announcement }),
    isCancelled,
    (id) => `${id}-${submissionId}`,
  );
  jobs.forEach((j) => {
    if (attempts.get(j.id) === token) attempts.delete(j.id);
  });
  set((state) => ({ isProcessing: hasPending(state.jobs) }));
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  jobs: [],
  settings: { ...RECOMMENDED_SETTINGS },
  workerPool: null,
  isProcessing: false,
  selectedCompareJobId: null,
  statusAnnouncement: 'Ready for image optimization.',
  isZipping: false,
  zipProgress: 0,
  batchError: null,
  zipError: null,
  resetSettings: () => set({ settings: { ...RECOMMENDED_SETTINGS } }),

  initPool: () => {
    if (!get().workerPool && typeof window !== 'undefined') {
      try {
        set({ workerPool: new WorkerPool() });
      } catch {
        const message =
          'Could not start image processing. Refresh the page or try an updated browser.';
        set({ batchError: message, statusAnnouncement: message });
      }
    }
  },

  setSelectedCompareJobId: (id) => set({ selectedCompareJobId: id }),
  setTargetFormat: (targetFormat) => set((s) => ({ settings: { ...s.settings, targetFormat } })),
  setMode: (mode) => set((s) => ({ settings: { ...s.settings, mode } })),
  setQualityTarget: (qualityTarget) => set((s) => ({ settings: { ...s.settings, qualityTarget } })),
  setStripMetadata: (stripMetadata) => set((s) => ({ settings: { ...s.settings, stripMetadata } })),
  setMaxDimension: (maxDim) =>
    set((s) => {
      const next = { ...s.settings };
      if (maxDim !== undefined) next.maxDimension = maxDim;
      else delete next.maxDimension;
      return { settings: next };
    }),

  addFiles: async (files: File[]) => {
    if (files.length === 0) return;

    const currentCount = get().jobs.length;
    if (currentCount + files.length > MAX_FILES_PER_BATCH) {
      const msg = `You can add up to ${MAX_FILES_PER_BATCH} images at a time. There are ${currentCount} here already. Clear finished images or choose fewer files.`;
      set({ batchError: msg, statusAnnouncement: msg });
      return;
    }

    const totalBytes = [
      ...get().jobs.map((job) => job.originalSize),
      ...files.map((file) => file.size),
    ].reduce((sum, size) => sum + size, 0);
    if (totalBytes > MAX_BATCH_INPUT_BYTES) {
      const message =
        'These images exceed the 100 MB workspace limit. Clear finished images or add a smaller batch.';
      set({ batchError: message, statusAnnouncement: message });
      return;
    }
    get().initPool();
    if (!get().workerPool) return;
    const newJobs: ImageJob[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      name: file.name,
      originalSize: file.size,
      status: 'queued',
      result: null,
      error: null,
    }));

    set((state) => ({
      jobs: [...state.jobs, ...newJobs],
      isProcessing: true,
      batchError: null,
      statusAnnouncement: `Added ${files.length} images. Making them smaller.`,
    }));
    await processSubmission(newJobs, get, set);
  },

  cancelJob: (id: string) => {
    processingAdmission.cancel(id);
    get().workerPool?.cancel(id);
    set((state) => {
      const jobs = state.jobs.map((j) =>
        j.id === id && (j.status === 'queued' || j.status === 'processing')
          ? { ...j, status: 'cancelled' as const }
          : j,
      );
      return {
        jobs,
        isProcessing: hasPending(jobs),
        statusAnnouncement: 'Image stopped. You can try again.',
      };
    });
  },

  cancelAll: () => {
    const pool = get().workerPool;
    get().jobs.forEach((j) => {
      if (j.status === 'queued' || j.status === 'processing') {
        processingAdmission.cancel(j.id);
        pool?.cancel(j.id);
      }
    });
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.status === 'queued' || j.status === 'processing' ? { ...j, status: 'cancelled' } : j,
      ),
      isProcessing: false,
      statusAnnouncement: 'All pending jobs cancelled.',
    }));
  },

  retryJob: async (id: string) => {
    const targetJob = get().jobs.find((j) => j.id === id);
    if (!targetJob || (targetJob.status !== 'error' && targetJob.status !== 'cancelled')) return;
    const retry = { ...targetJob, status: 'queued' as const, error: null, result: null };
    get().initPool();
    if (!get().workerPool) return;
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? retry : j)),
      isProcessing: true,
    }));
    await processSubmission([retry], get, set);
  },

  clearCompleted: () => {
    const completed = get().jobs.filter(
      (j) => j.status === 'done' || j.status === 'cancelled' || j.status === 'error',
    );
    completed.forEach((j) => void removeSpill(j.resultStorageId ?? j.id));
    set((state) => ({
      jobs: state.jobs.filter(
        (j) => j.status !== 'done' && j.status !== 'cancelled' && j.status !== 'error',
      ),
      selectedCompareJobId: null,
      statusAnnouncement: 'Cleared completed jobs.',
    }));
  },

  exportZip: async () => {
    if (get().isZipping) return;
    set({
      isZipping: true,
      zipProgress: 0,
      zipError: null,
      statusAnnouncement: 'Preparing your download...',
    });
    try {
      const blob = await exportBatchAsZip(get().jobs, {
        onProgress: (processed, total) => {
          const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
          set({ zipProgress: percent, statusAnnouncement: `Preparing download: ${percent}%.` });
        },
      });
      triggerZipDownload(blob);
      set({ statusAnnouncement: 'ZIP archive downloaded successfully.' });
    } catch {
      const message =
        'Could not prepare your download. Try again, or download images individually.';
      set({ zipError: message, statusAnnouncement: message });
    } finally {
      set({ isZipping: false, zipProgress: 0 });
    }
  },
}));
