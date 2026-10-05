/**
 * Raw RGBA image representation (ImageData-compatible).
 */
export interface RawImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Common encoder parameter options.
 */
export interface BaseEncodeOptions {
  quality?: number; // 1 - 100
  lossless?: boolean;
}

export interface JpegEncodeOptions extends BaseEncodeOptions {
  quality?: number;
  baseline?: boolean;
  arithmetic?: boolean;
  progressive?: boolean;
  optimizeCoding?: boolean;
  smoothing?: number;
  colorSpace?: number;
  quantTable?: number;
  trellisMultipass?: boolean;
  trellisOptZero?: boolean;
  trellisOptTable?: boolean;
  trellisLoops?: number;
  autoSubsample?: boolean;
  chromaSubsample?: number;
  separateChromaQTable?: boolean;
}

export interface PngEncodeOptions extends BaseEncodeOptions {
  level?: number; // 0 - 6 (oxipng optimization level)
  interlace?: boolean;
  optimiseAlpha?: boolean;
}

export interface WebpEncodeOptions extends BaseEncodeOptions {
  quality?: number; // 0 - 100
  targetSize?: number;
  targetPSNR?: number;
  method?: number; // 0 - 6 (quality/speed trade-off)
  snsStrength?: number;
  filterStrength?: number;
  filterSharpness?: number;
  filterType?: number;
  partitions?: number;
  segments?: number;
  pass?: number;
  showCompressed?: number;
  preprocessing?: number;
  autofilter?: number;
  partitionLimit?: number;
  alphaCompression?: number;
  alphaFiltering?: number;
  alphaQuality?: number;
  lossless?: boolean;
  exact?: number;
  imageHint?: number;
  emulateJpegSize?: number;
  threadLevel?: number;
  lowMemory?: number;
  nearLossless?: number;
  useDeltaPalette?: number;
  useSharpYUV?: number;
}

export interface AvifEncodeOptions extends BaseEncodeOptions {
  quality?: number; // 0 - 100
  cqLevel?: number; // 0 - 63 (0 is lossless, 63 is lowest quality)
  cqAlphaLevel?: number; // 0 - 63
  speed?: number; // 0 - 10 (higher is faster)
  lossless?: boolean;
}

export interface JxlEncodeOptions extends BaseEncodeOptions {
  quality?: number; // 0 - 100
  effort?: number; // 1 - 9 (1 fastest, 9 slowest/best)
  lossless?: boolean;
  decodingSpeed?: number; // 0 - 4
}

export interface GifEncodeOptions extends BaseEncodeOptions {
  paletteSize?: number; // max 256
  dither?: boolean;
}

export interface TiffEncodeOptions extends BaseEncodeOptions {
  compression?: boolean;
}

export interface BmpEncodeOptions extends BaseEncodeOptions {
  bitCount?: 24 | 32;
}

export interface SvgRenderOptions extends BaseEncodeOptions {
  width?: number;
  height?: number;
  dpi?: number;
  background?: string;
}

export type CodecEncodeOptions =
  | JpegEncodeOptions
  | PngEncodeOptions
  | WebpEncodeOptions
  | AvifEncodeOptions
  | JxlEncodeOptions
  | GifEncodeOptions
  | TiffEncodeOptions
  | BmpEncodeOptions
  | SvgRenderOptions;

/**
 * Universal Image Codec Interface
 * Every codec is a lazily loaded WASM module behind this unified interface.
 */
export interface ImageCodec<TOptions extends BaseEncodeOptions = BaseEncodeOptions> {
  readonly id: string;
  readonly mimeType: string;
  readonly defaultExtension: string;
  readonly canEncode: boolean;
  decode(buffer: ArrayBuffer): Promise<RawImage>;
  encode(image: RawImage, options?: TOptions): Promise<ArrayBuffer>;
}
