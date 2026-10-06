/**
 * Origin Private File System (OPFS) Spill Manager.
 * Offloads intermediate and finalized image buffers from JavaScript heap to private sandboxed disk,
 * maintaining a bounded memory footprint during large batch optimizations.
 * Falls back transparently to in-memory cache if OPFS is unavailable.
 */

const SPILL_DIR_NAME = 'tinute_spill';
const inMemoryFallback = new Map<string, ArrayBuffer>();
export const MAX_FALLBACK_BYTES = 64 * 1024 * 1024;
const storedSizes = new Map<string, number>();
const MAX_STORED_BYTES = 256 * 1024 * 1024;
function storeFallback(id: string, buffer: ArrayBuffer): void {
  const used = [...inMemoryFallback.entries()].reduce(
    (sum, [key, value]) => sum + (key === id ? 0 : value.byteLength),
    0,
  );
  if (used + buffer.byteLength > MAX_FALLBACK_BYTES)
    throw new Error('Result memory is full. Download finished images, clear them, and try again.');
  inMemoryFallback.set(id, buffer);
}
let storageLease: Promise<boolean> | undefined;

/** A shared browser lock protects live tabs; exclusive startup cleanup removes abandoned output. */
function acquireStorageLease(): Promise<boolean> {
  if (storageLease) return storageLease;
  storageLease = (async () => {
    if (!isOpfsSupported() || !navigator.locks) return false;
    try {
      await navigator.locks.request(
        'tinute-output-storage',
        { mode: 'exclusive', ifAvailable: true },
        async (lock) => {
          if (lock) {
            const root = await navigator.storage.getDirectory();
            try {
              await root.removeEntry(SPILL_DIR_NAME, { recursive: true });
            } catch {
              /* No abandoned directory. */
            }
          }
        },
      );
      return await new Promise<boolean>((resolve) => {
        void navigator.locks
          .request('tinute-output-storage', { mode: 'shared' }, async () => {
            resolve(true);
            // The browser releases this lease when the document is destroyed.
            await new Promise<void>(() => {});
          })
          .catch(() => resolve(false));
      });
    } catch {
      return false;
    }
  })();
  return storageLease;
}

export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage?.getDirectory === 'function'
  );
}

export async function getSpillDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!(await acquireStorageLease())) return null;
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(SPILL_DIR_NAME, { create: true });
  } catch {
    return null;
  }
}

/**
 * Persists an image buffer to OPFS or fallback cache.
 */
export async function spillToDisk(jobId: string, data: ArrayBuffer | Uint8Array): Promise<boolean> {
  const used = [...storedSizes.entries()].reduce(
    (sum, [key, value]) => sum + (key === jobId ? 0 : value),
    0,
  );
  if (used + data.byteLength > MAX_STORED_BYTES)
    throw new Error('Result storage is full. Download finished images, clear them, and try again.');
  // Reserve before awaiting disk operations so overlapping writes cannot bypass the budget.
  const previous = storedSizes.get(jobId);
  storedSizes.set(jobId, data.byteLength);
  try {
    const dir = await getSpillDirectory();
    const buffer = data instanceof Uint8Array ? data.slice().buffer : data;

    if (!dir) {
      storeFallback(jobId, buffer);
      return true;
    }

    try {
      const fileHandle = await dir.getFileHandle(`${jobId}.bin`, { create: true });
      // createWritable is supported in Chrome, Safari 15.2+, and Firefox 111+
      if ('createWritable' in fileHandle) {
        const writable = await fileHandle.createWritable();
        try {
          await writable.write(data);
          await writable.close();
        } catch (error) {
          await writable.abort().catch(() => {});
          throw error;
        }
        return true;
      }
      // Fallback if createWritable is missing
      storeFallback(jobId, buffer);
      return true;
    } catch {
      await dir.removeEntry(`${jobId}.bin`).catch(() => {});
      storeFallback(jobId, buffer);
      return false;
    }
  } catch (error) {
    if (previous === undefined) storedSizes.delete(jobId);
    else storedSizes.set(jobId, previous);
    throw error;
  }
}

/** Return a File/Blob without materializing stored output into the JS heap. */
export async function retrieveBlob(jobId: string): Promise<Blob | null> {
  const memory = inMemoryFallback.get(jobId);
  if (memory) return new Blob([memory]);
  const dir = await getSpillDirectory();
  if (!dir) return null;
  try {
    return await (await dir.getFileHandle(`${jobId}.bin`)).getFile();
  } catch {
    return null;
  }
}

/**
 * Retrieves a spilled buffer from OPFS or fallback cache.
 */
export async function retrieveFromDisk(jobId: string): Promise<ArrayBuffer | null> {
  const dir = await getSpillDirectory();

  if (!dir) {
    return inMemoryFallback.get(jobId) ?? null;
  }

  try {
    const fileHandle = await dir.getFileHandle(`${jobId}.bin`);
    const file = await fileHandle.getFile();
    return await file.arrayBuffer();
  } catch {
    return inMemoryFallback.get(jobId) ?? null;
  }
}

/**
 * Removes a spilled buffer from OPFS and fallback cache.
 */
export async function removeSpill(jobId: string): Promise<void> {
  storedSizes.delete(jobId);
  inMemoryFallback.delete(jobId);
  const dir = await getSpillDirectory();
  if (dir) {
    try {
      await dir.removeEntry(`${jobId}.bin`);
    } catch {
      // Ignore if file doesn't exist
    }
  }
}

/**
 * Clears the entire OPFS spill directory and memory fallback.
 */
export async function clearAllSpill(): Promise<void> {
  storedSizes.clear();
  inMemoryFallback.clear();
  if (!isOpfsSupported()) return;
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(SPILL_DIR_NAME, { recursive: true });
  } catch {
    // Ignore if not present
  }
}
