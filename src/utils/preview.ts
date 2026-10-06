import type { ImageFormat } from '../pipeline/types';
import { getMimeType } from './format';
import { processingAdmission, PROCESSING_BUDGET_BYTES } from '../workers/admission';

/** All production preview decoding happens in a disposable, resource-admitted worker. */
export async function createPreviewUrl(
  source: ArrayBuffer | Blob,
  format: ImageFormat,
  maxDimension = 1600,
  signal?: AbortSignal,
): Promise<{ url: string; revoke: () => void }> {
  const blob = source instanceof Blob ? source : new Blob([source], { type: getMimeType(format) });
  const id = `preview-${crypto.randomUUID()}`;
  const cancelWaiting = () => processingAdmission.cancel(id);
  signal?.addEventListener('abort', cancelWaiting, { once: true });
  let release: (() => void) | null = null;
  try {
    if (signal?.aborted) throw new Error('Preview cancelled.');
    release = await processingAdmission.acquire(
      id,
      PROCESSING_BUDGET_BYTES,
      maxDimension <= 96 ? 0 : 5,
    );
    if (!release || signal?.aborted) throw new Error('Preview cancelled.');
    // Test/non-worker environments may display native files without a software decode.
    if (typeof Worker === 'undefined') {
      if (!['jpeg', 'png', 'webp', 'gif', 'avif'].includes(format))
        throw new Error('Preview workers are unavailable.');
      const url = URL.createObjectURL(blob);
      return { url, revoke: () => URL.revokeObjectURL(url) };
    }
    const output = await new Promise<Blob>((resolve, reject) => {
      const worker = new Worker(new URL('../workers/preview.worker.ts', import.meta.url), {
        type: 'module',
      });
      const finish = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        worker.terminate();
      };
      const abort = () => {
        finish();
        reject(new Error('Preview cancelled.'));
      };
      const timer = setTimeout(() => {
        finish();
        reject(new Error('Preview took too long.'));
      }, 15000);
      signal?.addEventListener('abort', abort, { once: true });
      worker.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string }>) => {
        finish();
        if (event.data.blob) resolve(event.data.blob);
        else reject(new Error(event.data.error ?? 'Preview unavailable.'));
      };
      worker.onerror = () => {
        finish();
        reject(new Error('Preview unavailable.'));
      };
      try {
        worker.postMessage({ blob, format, maxDimension });
      } catch (error) {
        finish();
        reject(error);
      }
    });
    const url = URL.createObjectURL(output);
    return { url, revoke: () => URL.revokeObjectURL(url) };
  } finally {
    signal?.removeEventListener('abort', cancelWaiting);
    release?.();
  }
}
