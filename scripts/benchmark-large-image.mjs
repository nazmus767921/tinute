// Run pnpm dev first. Measures a deterministic 32 MP photo-like fixture, not the user's file.
import { chromium } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
const workerFile = (await readdir('dist/assets')).find((name) =>
  /^pipeline\.worker-.*\.js$/.test(name),
);
if (!workerFile) throw new Error('Run pnpm build before benchmarking.');
const format = process.env.TINUTE_BENCH_FORMAT ?? 'jpeg';
const workerUrl = `/assets/${workerFile}`;
if (!['jpeg', 'png', 'webp'].includes(format)) throw new Error('Unsupported benchmark format.');
const server = await chromium.launchServer({ headless: true });
const browser = await chromium.connect(server.wsEndpoint());
async function processMemory(pid) {
  try {
    const [rollup, children] = await Promise.all([
      readFile(`/proc/${pid}/smaps_rollup`, 'utf8'),
      readFile(`/proc/${pid}/task/${pid}/children`, 'utf8'),
    ]);
    const own = Number(rollup.match(/^Pss:\s+(\d+)/m)?.[1] ?? 0) * 1024;
    const childBytes = await Promise.all(
      children
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((child) => processMemory(Number(child))),
    );
    return own + childBytes.reduce((sum, bytes) => sum + bytes, 0);
  } catch {
    return 0;
  }
}
const baselineMemory = await processMemory(server.process().pid);
let peakMemory = baselineMemory;
let sampling = false;
const sampler = setInterval(async () => {
  if (sampling) return;
  sampling = true;
  try {
    peakMemory = Math.max(peakMemory, await processMemory(server.process().pid));
  } finally {
    sampling = false;
  }
}, 100);
try {
  const page = await browser.newPage();
  await page.route('**/assets/**', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    await route.fulfill({
      contentType: 'text/javascript',
      body: await readFile(`dist/assets/${name}`),
    });
  });
  await page.route('http://localhost:5173/', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html></html>' }),
  );
  await page.goto('http://localhost:5173');
  const result = await page.evaluate(
    async ({ workerUrl, format }) => {
      const canvas = new OffscreenCanvas(7372, 4392);
      const context = canvas.getContext('2d');
      const gradient = context.createLinearGradient(0, 0, 7372, 4392);
      gradient.addColorStop(0, '#137baf');
      gradient.addColorStop(0.5, '#fcba71');
      gradient.addColorStop(1, '#247343');
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
      let seed = 42;
      for (let i = 0; i < 60000; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const x = seed % 7372;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const y = seed % 4392;
        context.fillStyle = `rgba(${seed & 255},${(seed >>> 8) & 255},${(seed >>> 16) & 255},0.3)`;
        context.fillRect(x, y, 12, 12);
      }
      const source = await canvas.convertToBlob({ type: `image/${format}`, quality: 0.97 });
      canvas.width = canvas.height = 1;
      const { WorkerPool } = await import('/src/workers/WorkerPool.ts');
      const runs = [];
      const pool = new WorkerPool({
        maxWorkers: 1,
        workerFactory: () => new Worker(workerUrl, { type: 'module' }),
      });
      const settings = {
        targetFormat: 'preserve',
        mode: 'visually-lossless',
        stripMetadata: true,
        qualityTarget: 80,
      };
      try {
        for (let i = 0; i < 3; i++) {
          const buffer = await source.arrayBuffer();
          const start = performance.now();
          const result = await pool.submit({ id: `large-${i}`, buffer, settings });
          if (!result.ok) throw new Error(JSON.stringify(result.error));
          const wallMs = Math.round(performance.now() - start);
          const output = result.value;
          const decoded = await createImageBitmap(
            new Blob([output.outputBuffer], { type: `image/${output.outputFormat}` }),
          );
          runs.push({
            wallMs,
            pipelineMs: output.durationMs,
            format: output.outputFormat,
            inputBytes: source.size,
            outputBytes: output.finalSize,
            savings: output.savingsPercentage,
            width: decoded.width,
            height: decoded.height,
          });
          decoded.close();
        }
      } finally {
        pool.destroy();
      }
      return {
        fixture: `synthetic 7372x4392 ${format}; not representative of every photograph`,
        runs,
      };
    },
    { workerUrl, format },
  );
  console.log(
    JSON.stringify(
      {
        ...result,
        memory: {
          method:
            'sum of Chromium process-tree PSS sampled every 100ms; includes fixture generation',
          baselineMiB: Math.round(baselineMemory / 1048576),
          peakMiB: Math.round(peakMemory / 1048576),
          incrementalMiB: Math.round((peakMemory - baselineMemory) / 1048576),
        },
      },
      null,
      2,
    ),
  );
} finally {
  clearInterval(sampler);
  await browser.close();
  await server.close();
}
