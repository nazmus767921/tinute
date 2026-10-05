import { describe, it, expect, beforeEach } from 'vitest';
import {
  isOpfsSupported,
  spillToDisk,
  retrieveFromDisk,
  removeSpill,
  clearAllSpill,
} from '../opfs';

describe('OPFS Spill Storage with In-Memory Fallback', () => {
  beforeEach(async () => {
    await clearAllSpill();
  });

  it('detects OPFS support based on navigator.storage availability', () => {
    // In JSDOM, navigator.storage is typically undefined or mocked
    expect(typeof isOpfsSupported()).toBe('boolean');
  });

  it('spills and retrieves buffer correctly via fallback or OPFS', async () => {
    const testData = new Uint8Array([10, 20, 30, 40, 50]);
    const jobId = 'job-spill-test-1';

    const saved = await spillToDisk(jobId, testData);
    expect(saved).toBe(true);

    const retrieved = await retrieveFromDisk(jobId);
    expect(retrieved).not.toBeNull();
    const retrievedArr = new Uint8Array(retrieved!);
    expect(retrievedArr.length).toBe(5);
    expect(retrievedArr[0]).toBe(10);
    expect(retrievedArr[4]).toBe(50);
  });

  it('removes spilled buffer on demand', async () => {
    const testData = new Uint8Array([1, 2, 3]);
    const jobId = 'job-spill-test-2';

    await spillToDisk(jobId, testData);
    await removeSpill(jobId);

    const retrieved = await retrieveFromDisk(jobId);
    expect(retrieved).toBeNull();
  });

  it('clears all spilled buffers on clearAllSpill', async () => {
    await spillToDisk('job-a', new Uint8Array([1]));
    await spillToDisk('job-b', new Uint8Array([2]));

    await clearAllSpill();

    expect(await retrieveFromDisk('job-a')).toBeNull();
    expect(await retrieveFromDisk('job-b')).toBeNull();
  });
});
