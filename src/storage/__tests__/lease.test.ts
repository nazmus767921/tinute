import { it, expect, vi } from 'vitest';

it('cleans abandoned output only with an exclusive lease and holds a shared lease for live output', async () => {
  vi.resetModules();
  const root = {
    removeEntry: vi.fn().mockResolvedValue(undefined),
    getDirectoryHandle: vi.fn().mockResolvedValue({
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue({ write: vi.fn(), close: vi.fn() }),
      }),
    }),
  };
  const request = vi.fn(
    (_name: string, options: { mode: string }, callback: (lock: unknown) => unknown) =>
      Promise.resolve(callback({ mode: options.mode })),
  );
  const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage');
  const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: { getDirectory: vi.fn().mockResolvedValue(root) },
  });
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
  try {
    const { spillToDisk } = await import('../opfs');
    await spillToDisk('current', new ArrayBuffer(1));
    expect(request.mock.calls.map((call) => call[1].mode)).toEqual(['exclusive', 'shared']);
    expect(root.removeEntry).toHaveBeenCalledWith('tinute_spill', { recursive: true });
    await spillToDisk('next', new ArrayBuffer(1));
    expect(root.removeEntry).toHaveBeenCalledTimes(1);
  } finally {
    if (originalStorage) Object.defineProperty(navigator, 'storage', originalStorage);
    else Reflect.deleteProperty(navigator, 'storage');
    if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks);
    else Reflect.deleteProperty(navigator, 'locks');
    vi.resetModules();
  }
});
