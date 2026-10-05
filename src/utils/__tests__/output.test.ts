import { describe, it, expect, vi } from 'vitest';
import { imageJob } from '../../test/imageJob';
import { readJobOutput } from '../output';
import { retrieveFromDisk } from '../../storage/opfs';
vi.mock('../../storage/opfs', () => ({ retrieveFromDisk: vi.fn() }));
describe('released output buffers', () => {
  it('loads spilled output and refuses an empty download when storage is missing', async () => {
    const job = imageJob();
    job.result!.outputBuffer = new ArrayBuffer(0);
    job.result!.spillRef = 'attempt-key';
    vi.mocked(retrieveFromDisk).mockResolvedValueOnce(new ArrayBuffer(12));
    expect((await readJobOutput(job)).byteLength).toBe(12);
    expect(retrieveFromDisk).toHaveBeenCalledWith('attempt-key');
    vi.mocked(retrieveFromDisk).mockResolvedValueOnce(null);
    await expect(readJobOutput(job)).rejects.toThrow(/unavailable/i);
  });
  it('uses in-memory output without unnecessary disk reads', async () => {
    const job = imageJob();
    expect(await readJobOutput(job)).toBe(job.result!.outputBuffer);
  });
});
