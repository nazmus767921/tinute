import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicWasmDir = path.resolve(rootDir, 'public', 'wasm');

if (!fs.existsSync(publicWasmDir)) {
  fs.mkdirSync(publicWasmDir, { recursive: true });
}

// Find package paths in pnpm virtual store or standard node_modules
function findPackageFile(packageName, relativeFilePath) {
  const directPath = path.resolve(rootDir, 'node_modules', packageName, relativeFilePath);
  if (fs.existsSync(directPath)) return directPath;

  // Search in .pnpm directory
  const pnpmDir = path.resolve(rootDir, 'node_modules', '.pnpm');
  if (fs.existsSync(pnpmDir)) {
    const entries = fs.readdirSync(pnpmDir);
    const escapedPkg = packageName.replace('/', '+');
    const match = entries.find((e) => e.startsWith(escapedPkg));
    if (match) {
      const candidate = path.resolve(pnpmDir, match, 'node_modules', packageName, relativeFilePath);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  throw new Error(`Could not find ${relativeFilePath} for package ${packageName}`);
}

const wasmFiles = [
  { pkg: '@jsquash/jpeg', file: 'codec/enc/mozjpeg_enc.wasm', dest: 'mozjpeg_enc.wasm' },
  { pkg: '@jsquash/jpeg', file: 'codec/dec/mozjpeg_dec.wasm', dest: 'mozjpeg_dec.wasm' },
  { pkg: '@jsquash/png', file: 'codec/pkg/squoosh_png_bg.wasm', dest: 'squoosh_png_bg.wasm' },
  { pkg: '@jsquash/webp', file: 'codec/enc/webp_enc.wasm', dest: 'webp_enc.wasm' },
  { pkg: '@jsquash/webp', file: 'codec/dec/webp_dec.wasm', dest: 'webp_dec.wasm' },
  {
    pkg: '@jsquash/oxipng',
    file: 'codec/pkg/squoosh_oxipng_bg.wasm',
    dest: 'squoosh_oxipng_bg.wasm',
  },
  { pkg: '@jsquash/avif', file: 'codec/enc/avif_enc.wasm', dest: 'avif_enc.wasm' },
  { pkg: '@jsquash/avif', file: 'codec/dec/avif_dec.wasm', dest: 'avif_dec.wasm' },
  { pkg: '@jsquash/jxl', file: 'codec/enc/jxl_enc.wasm', dest: 'jxl_enc.wasm' },
  { pkg: '@jsquash/jxl', file: 'codec/dec/jxl_dec.wasm', dest: 'jxl_dec.wasm' },
  { pkg: '@resvg/resvg-wasm', file: 'index_bg.wasm', dest: 'resvg.wasm' },
  { pkg: 'libheif-js', file: 'libheif-wasm/libheif.wasm', dest: 'libheif.wasm' },
  { pkg: 'lcms-wasm', file: 'dist/lcms.wasm', dest: 'lcms.wasm' },
];

console.log('Copying WebAssembly codec binaries to public/wasm...');
for (const item of wasmFiles) {
  const src = findPackageFile(item.pkg, item.file);
  const dest = path.resolve(publicWasmDir, item.dest);
  fs.copyFileSync(src, dest);
  console.log(`✓ Copied ${item.dest} (${(fs.statSync(dest).size / 1024).toFixed(1)} KB)`);
}
console.log('All WASM binaries ready in public/wasm.\n');
