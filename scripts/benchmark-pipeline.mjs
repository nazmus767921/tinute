// Start `pnpm dev`, then run `node scripts/benchmark-pipeline.mjs`.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.route('http://localhost:5173/', (route) =>
  route.fulfill({ contentType: 'text/html', body: '<html></html>' }),
);
await page.goto('http://localhost:5173');
const result = await page.evaluate(async () => {
  const { webpCodec, jpegCodec } = await import('/src/codecs/index.ts');
  const { executePipeline } = await import('/src/pipeline/execute.ts');
  const { computePerceptualScore } = await import('/src/pipeline/qualityGate.ts');
  const width = 3000,
    height = 2000,
    data = new Uint8ClampedArray(width * height * 4);
  let seed = 42;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = ((seed >>> 24) - 128) * 0.45,
        i = (y * width + x) * 4;
      data[i] = 128 + 80 * Math.sin(x / 160) + noise;
      data[i + 1] = 128 + 80 * Math.sin(y / 120) + noise;
      data[i + 2] = 128 + 70 * Math.sin((x + y) / 190) + noise;
      data[i + 3] = 255;
    }
  const raw = { width, height, data };
  const input = await jpegCodec.encode(raw, { quality: 95 });
  const timings = [];
  const encode = webpCodec.encode.bind(webpCodec),
    decode = webpCodec.decode.bind(webpCodec);
  webpCodec.encode = async (im, op) => {
    const t = performance.now();
    const b = await encode(im, op);
    timings.push({
      stage: 'encode',
      pixels: im.width * im.height,
      options: op,
      ms: Math.round(performance.now() - t),
    });
    return b;
  };
  webpCodec.decode = async (b) => {
    const t = performance.now();
    const im = await decode(b);
    timings.push({ stage: 'decode', ms: Math.round(performance.now() - t) });
    return im;
  };
  const outputs = [];
  for (let i = 0; i < 2; i++) {
    const r = await executePipeline('bench', input, {
      targetFormat: 'auto',
      mode: 'visually-lossless',
      stripMetadata: true,
      qualityTarget: 80,
    });
    outputs.push(
      r.ok ? { ms: r.value.durationMs, bytes: r.value.finalSize, score: r.value.qualityScore } : r,
    );
  }
  const { WorkerPool } = await import('/src/workers/WorkerPool.ts');
  const pool = new WorkerPool({ maxWorkers: 1 });
  const workerStart = performance.now();
  const workerResult = await pool.submit({
    id: 'worker-benchmark',
    buffer: input.slice(0),
    settings: {
      targetFormat: 'auto',
      mode: 'visually-lossless',
      stripMetadata: true,
      qualityTarget: 80,
    },
  });
  const workerMs = Math.round(performance.now() - workerStart);
  pool.destroy();
  const t = performance.now();
  computePerceptualScore(raw, await decode(await encode(raw, { quality: 80, method: 0 })));
  const checkMs = performance.now() - t;
  return {
    width,
    height,
    inputBytes: input.byteLength,
    outputs,
    timings,
    checkMs,
    workerMs,
    workerOutput: workerResult.ok
      ? { bytes: workerResult.value.finalSize, score: workerResult.value.qualityScore }
      : workerResult,
  };
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
