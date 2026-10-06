import { Zip, ZipPassThrough } from 'fflate';
import type { ImageJob } from '../store/pipelineStore';
import { getOutputExtension } from './format';
import { readJobBlob } from './output';
import { getSpillDirectory } from '../storage/opfs';

export interface ZipExportOptions {
  suffix?: string; // default: '.optimized'
  onProgress?: (current: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Generates collision-free filenames for an archive.
 * Preserves original basename + configured suffix + target format extension.
 */
export function generateUniqueArchiveNames(
  jobs: ImageJob[],
  suffix = '.optimized',
): Map<string, string> {
  const nameMap = new Map<string, string>(); // jobId -> archiveFileName
  const usedNames = new Set<string>();

  for (const job of jobs) {
    if (!job.result) continue;

    const ext = getOutputExtension(job.name, job.result.outputFormat);
    const baseName = job.name.replace(/\.[^/.]+$/, '');
    let candidateName = `${baseName}${suffix}.${ext}`;
    let counter = 1;

    while (usedNames.has(candidateName.toLowerCase())) {
      candidateName = `${baseName} (${counter})${suffix}.${ext}`;
      counter++;
    }

    usedNames.add(candidateName.toLowerCase());
    nameMap.set(job.id, candidateName);
  }

  return nameMap;
}

/**
 * Streams completed jobs into a single ZIP archive using fflate.
 * Emits chunks asynchronously and triggers native browser download.
 */
export async function createStreamingZip(
  jobs: ImageJob[],
  options: ZipExportOptions = {},
): Promise<Blob> {
  const completedJobs = jobs.filter((j) => j.status === 'done' && j.result);
  if (completedJobs.length === 0) {
    throw new Error('No completed jobs available for ZIP export.');
  }

  const { suffix = '.optimized', onProgress } = options;
  const fileNameMap = generateUniqueArchiveNames(completedJobs, suffix);
  const directory = await getSpillDirectory();
  const temporaryName = `archive-${crypto.randomUUID()}.zip`;
  let writable: FileSystemWritableFileStream | undefined;
  let handle: FileSystemFileHandle | undefined;
  if (directory) {
    handle = await directory.getFileHandle(temporaryName, { create: true });
    try {
      writable = await handle.createWritable();
    } catch {
      await directory.removeEntry(temporaryName);
      handle = undefined;
    }
  }
  const chunks: Uint8Array[] = [];
  let fallbackBytes = 0;
  let writes = Promise.resolve();
  let zipError: Error | undefined;
  const zip = new Zip((error, chunk) => {
    if (error) {
      zipError = error;
      return;
    }
    if (!chunk) return;
    if (writable) {
      writes = writes.then(() => writable!.write(chunk));
      // A rejection is observed after each small input chunk, before admitting more input.
      void writes.catch(() => {});
    } else {
      fallbackBytes += chunk.byteLength;
      if (fallbackBytes > 64 * 1024 * 1024) {
        zipError = new Error(
          'Archive exceeds the browser memory limit. Download images individually.',
        );
        return;
      }
      chunks.push(chunk);
    }
  });
  const check = () => {
    if (options.signal?.aborted) throw new Error('Archive cancelled.');
    if (zipError) throw zipError;
  };
  try {
    let processed = 0;
    for (const job of completedJobs) {
      check();
      const archiveName = fileNameMap.get(job.id);
      if (!archiveName) continue;
      const blob = await readJobBlob(job);
      const entry = new ZipPassThrough(archiveName);
      zip.add(entry);
      for (let offset = 0; offset < blob.size; offset += 1024 * 1024) {
        check();
        const end = Math.min(blob.size, offset + 1024 * 1024);
        entry.push(new Uint8Array(await blob.slice(offset, end).arrayBuffer()), end === blob.size);
        await writes;
        check();
      }
      onProgress?.(++processed, completedJobs.length);
    }
    zip.end();
    await writes;
    check();
    if (writable && handle && directory) {
      await writable.close();
      const file = await handle.getFile();
      // Keep the backing file alive through the download's object-URL lifetime.
      setTimeout(() => {
        void directory.removeEntry(temporaryName).catch(() => {});
      }, 120_000);
      return file.slice(0, file.size, 'application/zip');
    }
    return new Blob(chunks, { type: 'application/zip' });
  } catch (error) {
    zip.terminate();
    await writable?.abort().catch(() => {});
    if (directory && handle) await directory.removeEntry(temporaryName).catch(() => {});
    throw error;
  }
}

/**
 * Downloads a Blob as a file in the browser.
 */
export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Keep the blob alive long enough for Safari to begin reading it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function triggerZipDownload(
  blob: Blob,
  filename = `tinute-optimized-${Date.now()}.zip`,
): void {
  triggerFileDownload(blob, filename);
}

export { createStreamingZip as exportBatchAsZip };
