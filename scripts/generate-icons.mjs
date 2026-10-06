import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.resolve(rootDir, 'public');

async function main() {
  console.log('Generating PWA icons and favicons...');
  const resvgModule = await import('@resvg/resvg-wasm');
  const wasmPath = path.resolve(publicDir, 'wasm', 'resvg.wasm');

  if (!fs.existsSync(wasmPath)) {
    throw new Error('resvg.wasm not found in public/wasm. Run pnpm copy:wasm first.');
  }

  const wasmBuffer = fs.readFileSync(wasmPath);
  await resvgModule.initWasm(wasmBuffer);

  const faviconSvgPath = path.resolve(publicDir, 'favicon.svg');
  const rawSvg = fs.readFileSync(faviconSvgPath, 'utf-8');
  const svgInnerMatch = rawSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  const innerSvg = svgInnerMatch ? svgInnerMatch[1] : rawSvg;

  // Render transparent standard icon
  function renderStandardIcon(size) {
    const scale = size / 48;
    const offsetY = (size - 46 * scale) / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <g transform="translate(0, ${offsetY}) scale(${scale})">
        ${innerSvg}
      </g>
    </svg>`;
    const r = new resvgModule.Resvg(svg, { fitTo: { mode: 'width', value: size } });
    return Buffer.from(r.render().asPng());
  }

  // Render icon with solid dark background and safe-zone margin (for maskable / apple-touch)
  function renderMaskableIcon(size, safeScaleRatio = 0.68) {
    const glyphSize = size * safeScaleRatio;
    const scale = glyphSize / 48;
    const offsetX = (size - glyphSize) / 2;
    const offsetY = (size - 46 * scale) / 2;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#0B0B0C"/>
      <g transform="translate(${offsetX}, ${offsetY}) scale(${scale})">
        ${innerSvg}
      </g>
    </svg>`;
    const r = new resvgModule.Resvg(svg, { fitTo: { mode: 'width', value: size } });
    return Buffer.from(r.render().asPng());
  }

  // Generate PNGs
  const p16 = renderStandardIcon(16);
  const p32 = renderStandardIcon(32);
  const p48 = renderStandardIcon(48);
  const p180Apple = renderMaskableIcon(180, 0.72);
  const p192 = renderStandardIcon(192);
  const p512 = renderStandardIcon(512);
  const pMaskable192 = renderMaskableIcon(192, 0.65);
  const pMaskable512 = renderMaskableIcon(512, 0.65);

  fs.writeFileSync(path.resolve(publicDir, 'favicon-16x16.png'), p16);
  fs.writeFileSync(path.resolve(publicDir, 'favicon-32x32.png'), p32);
  fs.writeFileSync(path.resolve(publicDir, 'favicon-48x48.png'), p48);
  fs.writeFileSync(path.resolve(publicDir, 'apple-touch-icon.png'), p180Apple);
  fs.writeFileSync(path.resolve(publicDir, 'icon-192x192.png'), p192);
  fs.writeFileSync(path.resolve(publicDir, 'icon-512x512.png'), p512);
  fs.writeFileSync(path.resolve(publicDir, 'icon-maskable-192x192.png'), pMaskable192);
  fs.writeFileSync(path.resolve(publicDir, 'icon-maskable-512x512.png'), pMaskable512);

  // Generate ICO (contains 16, 32, 48)
  const icoImages = [
    { width: 16, height: 16, data: p16 },
    { width: 32, height: 32, data: p32 },
    { width: 48, height: 48, data: p48 },
  ];

  const headerLength = 6;
  const dirEntryLength = 16;
  let offset = headerLength + icoImages.length * dirEntryLength;
  const totalIcoSize = offset + icoImages.reduce((acc, img) => acc + img.data.length, 0);
  const icoBuffer = Buffer.alloc(totalIcoSize);

  icoBuffer.writeUInt16LE(0, 0);
  icoBuffer.writeUInt16LE(1, 2);
  icoBuffer.writeUInt16LE(icoImages.length, 4);

  let dirOffset = headerLength;
  for (const img of icoImages) {
    icoBuffer.writeUInt8(img.width >= 256 ? 0 : img.width, dirOffset);
    icoBuffer.writeUInt8(img.height >= 256 ? 0 : img.height, dirOffset + 1);
    icoBuffer.writeUInt8(0, dirOffset + 2);
    icoBuffer.writeUInt8(0, dirOffset + 3);
    icoBuffer.writeUInt16LE(1, dirOffset + 4);
    icoBuffer.writeUInt16LE(32, dirOffset + 6);
    icoBuffer.writeUInt32LE(img.data.length, dirOffset + 8);
    icoBuffer.writeUInt32LE(offset, dirOffset + 12);

    img.data.copy(icoBuffer, offset);
    offset += img.data.length;
    dirOffset += dirEntryLength;
  }
  fs.writeFileSync(path.resolve(publicDir, 'favicon.ico'), icoBuffer);

  // Generate OpenGraph Social Card (1200x630)
  const ogScale = 2.4;
  const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <radialGradient id="glow1" cx="20%" cy="30%" r="50%">
        <stop offset="0%" stop-color="#863bff" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#0B0B0C" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="glow2" cx="80%" cy="70%" r="50%">
        <stop offset="0%" stop-color="#47bfff" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#0B0B0C" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="cardBorder" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#863bff" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#47bfff" stop-opacity="0.1"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="#0B0B0C"/>
    <rect width="1200" height="630" fill="url(#glow1)"/>
    <rect width="1200" height="630" fill="url(#glow2)"/>

    <!-- Subtle frame -->
    <rect x="32" y="32" width="1136" height="566" rx="24" fill="none" stroke="url(#cardBorder)" stroke-width="1.5"/>

    <!-- Logo icon -->
    <g transform="translate(100, 160) scale(${ogScale})">
      ${innerSvg}
    </g>

    <!-- Brand and titles -->
    <text x="240" y="245" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="76" font-weight="800" letter-spacing="-0.04em">Tinute<tspan fill="#ff3b86">.</tspan></text>
    
    <text x="100" y="340" fill="#EDEDEE" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="600" letter-spacing="-0.02em">In-Browser Image Converter &amp; Optimizer</text>
    
    <text x="100" y="390" fill="#98989F" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="400">Make images smaller with WebAssembly. Free. 100% Private. Zero server uploads.</text>

    <!-- Feature badges -->
    <g transform="translate(100, 440)">
      <rect x="0" y="0" width="160" height="42" rx="21" fill="#18181B" stroke="#27272A" stroke-width="1"/>
      <text x="80" y="26" fill="#D4D4D8" font-family="system-ui, sans-serif" font-size="15" font-weight="500" text-anchor="middle">100% Private</text>

      <rect x="176" y="0" width="170" height="42" rx="21" fill="#18181B" stroke="#27272A" stroke-width="1"/>
      <text x="261" y="26" fill="#D4D4D8" font-family="system-ui, sans-serif" font-size="15" font-weight="500" text-anchor="middle">No Uploads</text>

      <rect x="362" y="0" width="180" height="42" rx="21" fill="#18181B" stroke="#27272A" stroke-width="1"/>
      <text x="452" y="26" fill="#D4D4D8" font-family="system-ui, sans-serif" font-size="15" font-weight="500" text-anchor="middle">WebAssembly</text>

      <rect x="558" y="0" width="170" height="42" rx="21" fill="#18181B" stroke="#27272A" stroke-width="1"/>
      <text x="643" y="26" fill="#D4D4D8" font-family="system-ui, sans-serif" font-size="15" font-weight="500" text-anchor="middle">Free Forever</text>
    </g>

    <!-- Footer Attribution -->
    <text x="100" y="545" fill="#71717A" font-family="system-ui, sans-serif" font-size="18" font-weight="500">A product of Bohuvuj • bohuvuj.com</text>
  </svg>`;

  const ogResvg = new resvgModule.Resvg(ogSvg, { fitTo: { mode: 'width', value: 1200 } });
  const ogPng = Buffer.from(ogResvg.render().asPng());
  fs.writeFileSync(path.resolve(publicDir, 'og-image.png'), ogPng);

  console.log('✓ All icons, favicons, and OG image generated successfully.');
}

main().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
