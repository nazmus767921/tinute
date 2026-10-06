import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_BATCH_INPUT_BYTES, usePipelineStore } from '../pipelineStore';
import type { WorkerPool } from '../../workers/WorkerPool';
import { err } from '../../pipeline/types';
import { exportBatchAsZip } from '../../utils/zipExport';
import { imageJob } from '../../test/imageJob';
import { spillToDisk, removeSpill } from '../../storage/opfs';

vi.mock('../../storage/opfs', () => ({ spillToDisk: vi.fn(), removeSpill: vi.fn() }));
vi.mock('../../utils/zipExport', () => ({
  exportBatchAsZip: vi.fn().mockRejectedValue(new Error('disk full')),
  triggerZipDownload: vi.fn(),
}));

const defaults = {
  targetFormat: 'preserve' as const,
  mode: 'visually-lossless' as const,
  qualityTarget: 80,
  stripMetadata: true,
};
const file = (name: string) => {
  const f = new File(['x'], name, { type: 'image/png' });
  f.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(1));
  return f;
};
const failure = err({ code: 'DECODE_ERROR' as const, message: 'Choose another image.' });

describe('submission lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePipelineStore.setState({
      jobs: [],
      settings: { ...defaults },
      workerPool: null,
      isProcessing: false,
      selectedCompareJobId: null,
      batchError: null,
    });
  });

  it('rejects a workspace exceeding the memory budget before starting workers', async () => {
    const oversized = file('large.png');
    Object.defineProperty(oversized, 'size', { value: MAX_BATCH_INPUT_BYTES + 1 });
    await usePipelineStore.getState().addFiles([oversized]);
    expect(usePipelineStore.getState().jobs).toHaveLength(0);
    expect(usePipelineStore.getState().batchError).toMatch(/100 MB workspace/);
    expect(usePipelineStore.getState().workerPool).toBeNull();
  });
  it('submits each image once with its own settings and stays busy until both submissions finish', async () => {
    const finish: Array<(v: typeof failure) => void> = [];
    const submit = vi.fn(() => new Promise<typeof failure>((resolve) => finish.push(resolve)));
    usePipelineStore.setState({
      workerPool: { size: 1, submit, cancel: vi.fn() } as unknown as WorkerPool,
    });
    const first = usePipelineStore.getState().addFiles([file('a.png'), file('b.png')]);
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    usePipelineStore.getState().setTargetFormat('jpeg');
    const second = usePipelineStore.getState().addFiles([file('c.png')]);
    // The second submission waits for global admission; it cannot read ahead.
    expect(submit).toHaveBeenCalledTimes(1);
    finish[0]!(failure);
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    finish[1]!(failure);
    await second;
    expect(usePipelineStore.getState().isProcessing).toBe(true);
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(3));
    expect(
      submit.mock.calls.map(
        (call) => (call as unknown as [{ settings: typeof defaults }])[0].settings.targetFormat,
      ),
    ).toEqual(['preserve', 'jpeg', 'preserve']);
    finish[2]!(failure);
    await first;
    expect(usePipelineStore.getState().isProcessing).toBe(false);
  });

  it('does not execute queued cancelled work or resurrect stopped work', async () => {
    let finish!: (v: typeof failure) => void;
    const submit = vi.fn(
      () =>
        new Promise<typeof failure>((resolve) => {
          finish = resolve;
        }),
    );
    usePipelineStore.setState({
      workerPool: { size: 1, submit, cancel: vi.fn() } as unknown as WorkerPool,
    });
    const pending = usePipelineStore.getState().addFiles([file('a.png'), file('b.png')]);
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    usePipelineStore.getState().cancelAll();
    finish(failure);
    await pending;
    expect(submit).toHaveBeenCalledTimes(1);
    expect(usePipelineStore.getState().jobs.map((j) => j.status)).toEqual([
      'cancelled',
      'cancelled',
    ]);
  });

  it('retries in place rather than leaving a ghost queued job', async () => {
    const submit = vi.fn().mockResolvedValue(failure);
    usePipelineStore.setState({
      workerPool: { size: 1, submit, cancel: vi.fn() } as unknown as WorkerPool,
    });
    await usePipelineStore.getState().addFiles([file('a.png')]);
    const id = usePipelineStore.getState().jobs[0]!.id;
    await usePipelineStore.getState().retryJob(id);
    expect(usePipelineStore.getState().jobs).toHaveLength(1);
    expect(usePipelineStore.getState().jobs[0]!.status).toBe('error');
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('settles an oversized-only batch', async () => {
    const f = file('large.png');
    Object.defineProperty(f, 'size', { value: 51 * 1024 * 1024 });
    usePipelineStore.setState({
      workerPool: { size: 1, submit: vi.fn(), cancel: vi.fn() } as unknown as WorkerPool,
    });
    await usePipelineStore.getState().addFiles([f]);
    expect(usePipelineStore.getState().isProcessing).toBe(false);
    expect(usePipelineStore.getState().jobs[0]!.status).toBe('error');
  }, 1000);

  it('restores recommended defaults', () => {
    usePipelineStore.setState({
      settings: { ...defaults, targetFormat: 'png', maxDimension: 1920, stripMetadata: false },
    });
    usePipelineStore.getState().resetSettings();
    expect(usePipelineStore.getState().settings).toEqual(defaults);
  });

  it('clears failed images so a rejected batch can be started over', () => {
    usePipelineStore.setState({
      jobs: [
        {
          id: 'failed',
          file: file('bad.png'),
          name: 'bad.png',
          originalSize: 1,
          status: 'error',
          result: null,
          error: { code: 'DECODE_ERROR', message: 'Unreadable' },
        },
      ],
    });
    usePipelineStore.getState().clearCompleted();
    expect(usePipelineStore.getState().jobs).toHaveLength(0);
  });

  it('converts archive file counts into real percentage progress', async () => {
    const progress: number[] = [];
    const unsubscribe = usePipelineStore.subscribe((state) => progress.push(state.zipProgress));
    vi.mocked(exportBatchAsZip).mockImplementationOnce(async (_jobs, options) => {
      options?.onProgress?.(1, 2);
      options?.onProgress?.(2, 2);
      return new Blob([]);
    });
    await usePipelineStore.getState().exportZip();
    unsubscribe();
    expect(progress).toContain(50);
    expect(progress).toContain(100);
  });

  it('does not open comparison when an image completes', async () => {
    const result = imageJob().result!;
    usePipelineStore.setState({
      workerPool: {
        size: 1,
        submit: vi.fn().mockResolvedValue({ ok: true, value: result }),
        cancel: vi.fn(),
      } as unknown as WorkerPool,
    });
    await usePipelineStore.getState().addFiles([file('a.png')]);
    expect(usePipelineStore.getState().jobs[0]!.status).toBe('done');
    expect(usePipelineStore.getState().selectedCompareJobId).toBeNull();
  });

  it('isolates retry output from an older cancelled disk write', async () => {
    let finishWrite!: () => void;
    vi.mocked(spillToDisk).mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finishWrite = () => resolve(true);
        }),
    );
    const result = imageJob().result!;
    const submit = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, value: result })
      .mockResolvedValueOnce({ ok: true, value: { ...result, outputFormat: 'png' } });
    usePipelineStore.setState({
      workerPool: { size: 1, submit, cancel: vi.fn() } as unknown as WorkerPool,
    });
    const first = usePipelineStore.getState().addFiles([file('a.png')]);
    await vi.waitFor(() => expect(spillToDisk).toHaveBeenCalledOnce());
    const id = usePipelineStore.getState().jobs[0]!.id;
    usePipelineStore.getState().cancelJob(id);
    await usePipelineStore.getState().retryJob(id);
    const oldKey = vi.mocked(spillToDisk).mock.calls[0]![0];
    const newKey = vi.mocked(spillToDisk).mock.calls[1]![0];
    finishWrite();
    await first;
    expect(newKey).not.toBe(oldKey);
    expect(usePipelineStore.getState().jobs[0]!.resultStorageId).toBe(newKey);
    expect(usePipelineStore.getState().jobs[0]!.result!.outputFormat).toBe('png');
    expect(removeSpill).toHaveBeenCalledWith(oldKey);
  });

  it('exposes export failures for visible recovery', async () => {
    await usePipelineStore.getState().exportZip();
    expect(usePipelineStore.getState().zipError).toMatch(/download|prepare/i);
    expect(usePipelineStore.getState().isZipping).toBe(false);
  });
});
