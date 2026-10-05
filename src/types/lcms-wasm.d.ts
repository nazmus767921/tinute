declare module 'lcms-wasm' {
  export interface LcmsInstance {
    cmsOpenProfileFromMem(mem: Uint8Array, size: number): number;
    cmsCloseProfile(profile: number): boolean;
    cmsCreate_sRGBProfile(): number;
    cmsCreateXYZProfile(): number;
    cmsCreateLab4Profile(): number;
    cmsGetHeaderRenderingIntent(profile: number): number;
    cmsGetProfileInfoASCII(
      profile: number,
      info: number,
      language: string,
      country: string,
    ): string;
    cmsGetColorSpace(profile: number): number;
    cmsGetColorSpaceASCII(profile: number): string;
    cmsCreateTransform(
      inputProfile: number,
      inputFormat: number,
      outputProfile: number,
      outputFormat: number,
      intent: number,
      flags: number,
    ): number;
    cmsDeleteTransform(transform: number): void;
    cmsDoTransform(transform: number, inputBuffer: Uint8Array, pixelCount: number): Uint8Array;
  }

  export const TYPE_RGB_8: number;
  export const TYPE_RGBA_8: number;
  export const TYPE_BGR_8: number;
  export const TYPE_BGRA_8: number;
  export const INTENT_PERCEPTUAL: number;
  export const INTENT_RELATIVE_COLORIMETRIC: number;
  export const INTENT_SATURATION: number;
  export const INTENT_ABSOLUTE_COLORIMETRIC: number;
  export const cmsInfoDescription: number;

  export interface LcmsOptions {
    wasmBinary?: ArrayBuffer | Uint8Array;
    locateFile?: (path: string, scriptDirectory?: string) => string;
  }

  export function instantiate(options?: LcmsOptions): Promise<LcmsInstance>;
  export default instantiate;
}
