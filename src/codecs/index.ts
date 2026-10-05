export * from './types';
export * from './wasmLoader';
export { jpegCodec } from './jpegCodec';
export { pngCodec } from './pngCodec';
export { webpCodec } from './webpCodec';
export { avifCodec } from './avifCodec';
export { jxlCodec } from './jxlCodec';
export { gifCodec } from './gifCodec';
export { heicCodec } from './heicCodec';
export { tiffCodec } from './tiffCodec';
export { bmpCodec } from './bmpCodec';
export { svgCodec } from './svgCodec';

import { jpegCodec } from './jpegCodec';
import { pngCodec } from './pngCodec';
import { webpCodec } from './webpCodec';
import { avifCodec } from './avifCodec';
import { jxlCodec } from './jxlCodec';
import { gifCodec } from './gifCodec';
import { heicCodec } from './heicCodec';
import { tiffCodec } from './tiffCodec';
import { bmpCodec } from './bmpCodec';
import { svgCodec } from './svgCodec';
import type { ImageCodec } from './types';

const codecs: Record<string, ImageCodec> = {
  jpeg: jpegCodec,
  jpg: jpegCodec,
  png: pngCodec,
  webp: webpCodec,
  avif: avifCodec,
  jxl: jxlCodec,
  gif: gifCodec,
  heic: heicCodec,
  heif: heicCodec,
  tiff: tiffCodec,
  tif: tiffCodec,
  bmp: bmpCodec,
  svg: svgCodec,
};

export function getCodec(format: string): ImageCodec | undefined {
  const normalized = format.toLowerCase().trim();
  return codecs[normalized];
}
