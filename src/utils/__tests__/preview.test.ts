import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPreviewUrl } from '../preview';
import { processingAdmission, PROCESSING_BUDGET_BYTES } from '../../workers/admission';

describe('preview worker ownership', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function installWorker(throws = false) {
    const terminate = vi.fn();
    const instances: Array<{ onmessage?: (event: { data: { blob: Blob } }) => void }> = [];
    vi.stubGlobal(
      'Worker',
      class {
        onmessage?: (event: { data: { blob: Blob } }) => void;
        terminate = terminate;
        constructor() {
          instances.push(this);
        }
        postMessage() {
          if (throws) throw new Error('transfer failed');
        }
      },
    );
    return { terminate, instances };
  }

  it('terminates a completed worker and returns a revocable display URL', async () => {
    const { terminate, instances } = installWorker();
    const pending = createPreviewUrl(new Blob(['source']), 'jpeg');
    await vi.waitFor(() => expect(instances).toHaveLength(1));
    instances[0]!.onmessage!({ data: { blob: new Blob(['preview']) } });
    const preview = await pending;
    expect(terminate).toHaveBeenCalledOnce();
    expect(preview.url).toBeTruthy();
    preview.revoke();
  });

  it('aborts decoding immediately and releases global admission', async () => {
    const { terminate, instances } = installWorker();
    const controller = new AbortController();
    const pending = createPreviewUrl(new Blob(['source']), 'jpeg', 1600, controller.signal);
    const rejected = expect(pending).rejects.toThrow(/cancelled/);
    await vi.waitFor(() => expect(instances).toHaveLength(1));
    controller.abort();
    await rejected;
    expect(terminate).toHaveBeenCalledOnce();
    const release = await processingAdmission.acquire('after-abort', PROCESSING_BUDGET_BYTES);
    expect(release).toBeTypeOf('function');
    release?.();
  });

  it('cleans up a failed message transfer without waiting for the deadline', async () => {
    const { terminate } = installWorker(true);
    await expect(createPreviewUrl(new Blob(['source']), 'jpeg')).rejects.toThrow('transfer failed');
    expect(terminate).toHaveBeenCalledOnce();
  });
});
