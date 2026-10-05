import { Zip, ZipPassThrough } from 'fflate';
import type { ImageJob } from '../store/pipelineStore';
import { getFileExtension } from './format';
import { readJobOutput } from './output';

export interface ZipExportOptions {
  suffix?: string; // default: '.optimized'
  onProgress?: (current: number, total: number) => void;
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

    const ext = getFileExtension(job.result.outputFormat);
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
  const chunks: Uint8Array[] = [];

  return new Promise<Blob>((resolve, reject) => {
    try {
      const zip = new Zip((err, chunk, isLast) => {
        if (err) {
          reject(err);
          return;
        }
        if (chunk) {
          chunks.push(chunk);
        }
        if (isLast) {
          const blob = new Blob(chunks, { type: 'application/zip' });
          resolve(blob);
        }
      });

      // Stream jobs sequentially to avoid memory spikes
      (async () => {
        let processed = 0;
        const total = completedJobs.length;

        for (const job of completedJobs) {
          const archiveName = fileNameMap.get(job.id);
          if (!archiveName || !job.result) continue;

          const buffer = await readJobOutput(job);

          const fileStream = new ZipPassThrough(archiveName);
          zip.add(fileStream);

          // Push binary data as Uint8Array
          const u8 = new Uint8Array(buffer);
          fileStream.push(u8, true);

          processed++;
          onProgress?.(processed, total);
        }

        zip.end();
      })().catch(reject);
    } catch (err) {
      reject(err);
    }
  });
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
