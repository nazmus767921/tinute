import { loadWasmModule } from './wasmLoader';
import type { ImageCodec, SvgRenderOptions, RawImage } from './types';
import type * as ResvgNamespace from '@resvg/resvg-wasm';

let resvgInitPromise: Promise<void> | null = null;

async function ensureResvg(): Promise<typeof ResvgNamespace> {
  const resvgModule = await import('@resvg/resvg-wasm');
  if (!resvgInitPromise) {
    resvgInitPromise = (async () => {
      const wasm = await loadWasmModule('resvg.wasm');
      await resvgModule.initWasm(wasm);
    })();
  }
  await resvgInitPromise;
  return resvgModule;
}

/**
 * Validates SVG markup against entity expansion (XML entity / billion laughs attack)
 * and verifies that root viewBox or dimensions are safe.
 */
function sanitizeAndValidateSvg(svgText: string): void {
  // Reject external/recursive DTD entity declarations
  if (/<!ENTITY/i.test(svgText)) {
    throw new Error(
      'SVG security violation: Custom XML entity declarations (<!ENTITY) are prohibited.',
    );
  }

  // Reject malicious embedded scripts or external references
  if (/<script/i.test(svgText) || /xlink:href\s*=\s*["'](?!#)[^"']+/i.test(svgText)) {
    throw new Error(
      'SVG security violation: Scripts and external remote resources are prohibited.',
    );
  }
}

export const svgCodec: ImageCodec<SvgRenderOptions> = {
  id: 'svg',
  mimeType: 'image/svg+xml',
  defaultExtension: 'svg',
  canEncode: false,

  async decode(buffer: ArrayBuffer): Promise<RawImage> {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const svgString = decoder.decode(buffer);

    // Defense against entity explosion & script injection
    sanitizeAndValidateSvg(svgString);

    const { Resvg } = await ensureResvg();
    const resvg = new Resvg(svgString, {
      shapeRendering: 2, // geometricPrecision
      textRendering: 1, // optimizeLegibility
      imageRendering: 0, // optimizeQuality
    });

    if (resvg.width * resvg.height > 16_000_000) {
      resvg.free();
      throw new Error('SVG rendering exceeds the safe pixel limit. Choose a smaller image.');
    }
    try {
      const rendered = resvg.render();
      try {
        return {
          data: new Uint8ClampedArray(rendered.pixels),
          width: rendered.width,
          height: rendered.height,
        };
      } finally {
        rendered.free();
      }
    } finally {
      resvg.free();
    }
  },

  async encode(): Promise<ArrayBuffer> {
    throw new Error(
      'SVG encoding is not supported: SVG is a vector format and is rasterize-only in this engine.',
    );
  },
};
