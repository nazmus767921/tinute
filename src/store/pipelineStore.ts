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

export const usePipelineStore = create<PipelineState>((set, get) => ({
  jobs: [],
  settings: {
    targetFormat: 'auto',
    mode: 'visually-lossless',
    stripMetadata: true,
    qualityTarget: 80,
  },
  workerPool: null,
  isProcessing: false,
  selectedCompareJobId: null,
  statusAnnouncement: 'Ready for image optimization.',
  isZipping: false,
  zipProgress: 0,
  batchError: null,

  initPool: () => {
    if (!get().workerPool && typeof window !== 'undefined') {
      set({ workerPool: new WorkerPool() });
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
      const msg = `Batch limit exceeded: Maximum ${MAX_FILES_PER_BATCH} files allowed per batch (currently ${currentCount}, tried adding ${files.length}).`;
      set({ batchError: msg, statusAnnouncement: msg });
      return;
    }

    get().initPool();
    const pool = get().workerPool;
    if (!pool) return;

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
      statusAnnouncement: `Added ${files.length} file(s) to optimization queue.`,
    }));

    // Dispatch batch orchestrator with concurrent worker scheduling
    await runBatchOrchestrator(
      pool,
      get().jobs,
      get().settings,
      (id, updates) => {
        set((state) => ({
          jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
          selectedCompareJobId:
            state.selectedCompareJobId ??
            (updates.status === 'done' ? id : state.selectedCompareJobId),
        }));
      },
      (announcement) => set({ statusAnnouncement: announcement }),
    );

    set({ isProcessing: false });
  },

  cancelJob: (id: string) => {
    get().workerPool?.cancel(id);
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, status: 'cancelled' } : j)),
      statusAnnouncement: 'Job cancelled.',
    }));
  },

  cancelAll: () => {
    const pool = get().workerPool;
    get().jobs.forEach((j) => {
      if (j.status === 'queued' || j.status === 'processing') {
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
    if (!targetJob) return;
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, status: 'queued', error: null, result: null } : j,
      ),
    }));
    await get().addFiles([targetJob.file]);
  },

  clearCompleted: () => {
    const completed = get().jobs.filter((j) => j.status === 'done' || j.status === 'cancelled');
    completed.forEach((j) => void removeSpill(j.id));
    set((state) => ({
      jobs: state.jobs.filter((j) => j.status !== 'done' && j.status !== 'cancelled'),
      selectedCompareJobId: null,
      statusAnnouncement: 'Cleared completed jobs.',
    }));
  },

  exportZip: async () => {
    set({ isZipping: true, zipProgress: 0, statusAnnouncement: 'Preparing ZIP archive...' });
    try {
      const blob = await exportBatchAsZip(get().jobs, {
        onProgress: (pct, file) =>
          set({ zipProgress: pct, statusAnnouncement: `Zipping (${pct}%): ${file}` }),
      });
      triggerZipDownload(blob);
      set({ statusAnnouncement: 'ZIP archive downloaded successfully.' });
    } catch (err) {
      set({ statusAnnouncement: `ZIP export failed: ${String(err)}` });
    } finally {
      set({ isZipping: false, zipProgress: 0 });
    }
  },
}));
