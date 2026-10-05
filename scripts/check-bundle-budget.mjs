import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const BUDGET_KB = 150;
const BUDGET_BYTES = BUDGET_KB * 1024;
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');

if (!fs.existsSync(ASSETS_DIR)) {
  console.error(`Error: Assets directory not found at ${ASSETS_DIR}. Run 'pnpm build' first.`);
  process.exit(1);
}

const files = fs.readdirSync(ASSETS_DIR);
const jsFiles = files.filter((f) => f.endsWith('.js') && !f.endsWith('.map'));

if (jsFiles.length === 0) {
  console.error('Error: No JavaScript asset bundles found in dist/assets.');
  process.exit(1);
}

// Extract initial bundle script files referenced in index.html (entry + modulepreload)
const initialScripts = new Set();
if (fs.existsSync(INDEX_HTML)) {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const regex = /(?:src|href)="\/assets\/([^"]+\.js)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) initialScripts.add(match[1]);
  }
}

console.log('\n=== Performance Budget Verification ===');
console.log(
  `Initial JS Bundle Budget: ${BUDGET_KB} KB gzipped (${BUDGET_BYTES.toLocaleString()} bytes)\n`,
);

let totalInitialGzipBytes = 0;
let totalInitialRawBytes = 0;

console.log(
  `${'Initial Entry Bundle'.padEnd(45)} | ${'Raw Size'.padStart(12)} | ${'Gzip Size'.padStart(12)} | ${'Status'.padStart(8)}`,
);
console.log('-'.repeat(85));

for (const file of jsFiles) {
  if (initialScripts.size > 0 && !initialScripts.has(file)) {
    continue; // Lazy WASM / worker chunk loaded on demand
  }

  const filePath = path.join(ASSETS_DIR, file);
  const content = fs.readFileSync(filePath);
  const rawSize = content.length;
  const gzipSize = zlib.gzipSync(content).length;

  totalInitialRawBytes += rawSize;
  totalInitialGzipBytes += gzipSize;

  const rawSizeStr = `${(rawSize / 1024).toFixed(2)} KB`;
  const gzipSizeStr = `${(gzipSize / 1024).toFixed(2)} KB`;
  const status = gzipSize <= BUDGET_BYTES ? 'OK' : 'OVER';

  console.log(
    `${file.padEnd(45)} | ${rawSizeStr.padStart(12)} | ${gzipSizeStr.padStart(12)} | ${status.padStart(8)}`,
  );
}

console.log('-'.repeat(85));
const totalRawKb = (totalInitialRawBytes / 1024).toFixed(2);
const totalGzipKb = (totalInitialGzipBytes / 1024).toFixed(2);
console.log(
  `${'TOTAL (Initial Bundles)'.padEnd(45)} | ${(totalRawKb + ' KB').padStart(12)} | ${(totalGzipKb + ' KB').padStart(12)} |`,
);

const percentOfBudget = ((totalInitialGzipBytes / BUDGET_BYTES) * 100).toFixed(1);
console.log(`\nResult: ${totalGzipKb} KB / ${BUDGET_KB} KB (${percentOfBudget}% of budget)`);

if (totalInitialGzipBytes > BUDGET_BYTES) {
  console.error(
    `\n❌ BUDGET EXCEEDED: Initial JS bundle is ${totalGzipKb} KB, exceeding the limit of ${BUDGET_KB} KB gzipped by ${(
      totalInitialGzipBytes - BUDGET_BYTES
    ).toLocaleString()} bytes!`,
  );
  process.exit(1);
} else {
  console.log(`✅ BUDGET PASSED: Initial JS bundle is well within the ${BUDGET_KB} KB limit.\n`);
}
