/**
 * WASM Binary Loader and Memory Cache
 * Handles both browser/worker fetch and Node/Vitest filesystem environments.
 */

const moduleCache = new Map<string, Promise<WebAssembly.Module>>();

export async function loadWasmModule(fileName: string): Promise<WebAssembly.Module> {
  const cached = moduleCache.get(fileName);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    // 1. Node / Vitest runtime fallback
    if (typeof process !== 'undefined' && process.versions?.node) {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const fullPath = path.resolve(process.cwd(), 'public', 'wasm', fileName);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`WASM binary not found at ${fullPath}. Run 'node scripts/copy-wasm.mjs'`);
      }
      const buffer = fs.readFileSync(fullPath);
      return new WebAssembly.Module(buffer);
    }

    // 2. Browser & Web Worker runtime
    const response = await fetch(`/wasm/${fileName}`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch WASM binary /wasm/${fileName}: HTTP ${response.status} ${response.statusText}`,
      );
    }

    if (typeof WebAssembly.compileStreaming === 'function') {
      try {
        return await WebAssembly.compileStreaming(response.clone());
      } catch {
        // Fallback if Content-Type was not application/wasm
        const arrayBuf = await response.arrayBuffer();
        return await WebAssembly.compile(arrayBuf);
      }
    }

    const arrayBuf = await response.arrayBuffer();
    return await WebAssembly.compile(arrayBuf);
  })();

  moduleCache.set(fileName, promise);
  void promise.catch(() => moduleCache.delete(fileName));
  return promise;
}
