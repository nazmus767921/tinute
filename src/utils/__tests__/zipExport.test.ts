import { describe, it, expect, vi } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { generateUniqueArchiveNames, createStreamingZip } from '../zipExport';
import type { ImageJob } from '../../store/pipelineStore';

describe('ZIP Export and Collision Handling', () => {
  const createMockJob = (
    id: string,
    name: string,
    data: Uint8Array,
    format: 'webp' | 'jpeg',
  ): ImageJob => ({
    id,
    file: new File([data], name, { type: 'image/jpeg' }),
    name,
    originalSize: data.byteLength * 2,
    status: 'done',
    result: {
      id,
      outputBuffer: data.buffer,
      outputFormat: format,
      originalFormat: 'jpeg',
      originalSize: data.byteLength * 2,
      finalSize: data.byteLength,
      savedBytes: data.byteLength,
      savingsPercentage: 50,
      neverBiggerTriggered: false,
      qualityScore: 90,
      isLosslessBitExact: false,
      classification: 'photo',
      mode: 'visually-lossless',
      metadataReport: { gpsRemoved: true, exifRemoved: true, iccPreserved: true },
      durationMs: 15,
    },
    error: null,
  });

  it('generates unique archive names and handles duplicate filenames with numbered suffixes', () => {
    const jobs = [
      createMockJob('job-1', 'image.jpg', new Uint8Array([1]), 'webp'),
      createMockJob('job-2', 'image.jpg', new Uint8Array([2]), 'webp'),
      createMockJob('job-3', 'IMAGE.JPG', new Uint8Array([3]), 'webp'),
      createMockJob('job-4', 'banner.png', new Uint8Array([4]), 'jpeg'),
    ];

    const names = generateUniqueArchiveNames(jobs, '.optimized');

    expect(names.get('job-1')).toBe('image.optimized.webp');
    expect(names.get('job-2')).toBe('image (1).optimized.webp');
    expect(names.get('job-3')).toBe('IMAGE (2).optimized.webp');
    expect(names.get('job-4')).toBe('banner.optimized.jpg');
  });

  it('creates a streaming ZIP file that can be accurately unzipped and verified', async () => {
    const job1Data = new TextEncoder().encode('webp-image-1');
    const job2Data = new TextEncoder().encode('webp-image-2');

    const jobs = [
      createMockJob('j1', 'photo1.jpg', job1Data, 'webp'),
      createMockJob('j2', 'photo2.jpg', job2Data, 'webp'),
    ];

    const progressSpy = vi.fn();
    const zipBlob = await createStreamingZip(jobs, {
      suffix: '.min',
      onProgress: progressSpy,
    });

    expect(zipBlob.type).toBe('application/zip');
    expect(zipBlob.size).toBeGreaterThan(0);
    expect(progressSpy).toHaveBeenCalledWith(1, 2);
    expect(progressSpy).toHaveBeenCalledWith(2, 2);

    // Read ZIP content back using fflate.unzipSync to verify contents
    const arrayBuffer = await zipBlob.arrayBuffer();
    const unzipped = unzipSync(new Uint8Array(arrayBuffer));

    expect(Object.keys(unzipped)).toContain('photo1.min.webp');
    expect(Object.keys(unzipped)).toContain('photo2.min.webp');
    expect(strFromU8(unzipped['photo1.min.webp']!)).toBe('webp-image-1');
    expect(strFromU8(unzipped['photo2.min.webp']!)).toBe('webp-image-2');
  });

  it('throws an error if no completed jobs are provided', async () => {
    const pendingJob: ImageJob = {
      id: 'pending-1',
      file: new File([], 'pending.jpg'),
      name: 'pending.jpg',
      originalSize: 100,
      status: 'queued',
      result: null,
      error: null,
    };

    await expect(createStreamingZip([pendingJob])).rejects.toThrow(/no completed jobs/i);
  });
});
