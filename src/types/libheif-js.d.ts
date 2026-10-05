declare module 'libheif-js' {
  export interface HeifImageFrame {
    get_width(): number;
    get_height(): number;
    is_primary(): boolean;
    has_alpha_channel(): boolean;
    is_premultiplied_alpha(): boolean;
    display(
      imageData: { data: Uint8ClampedArray; width: number; height: number },
      callback: (
        displayData: { data: Uint8ClampedArray; width: number; height: number } | null,
      ) => void,
    ): void;
    free(): void;
  }

  export class HeifDecoder {
    decode(buffer: ArrayBuffer | Uint8Array): HeifImageFrame[];
  }

  interface LibHeifModule {
    HeifDecoder: typeof HeifDecoder;
  }

  const libheif: LibHeifModule;
  export default libheif;
}

declare module 'libheif-js/libheif-wasm/libheif.js' {
  import type { HeifDecoder } from 'libheif-js';

  export interface LibHeifInstance {
    HeifDecoder: typeof HeifDecoder;
  }

  export type LibHeifFactory = (options: {
    wasmBinary: ArrayBuffer | Uint8Array;
  }) => Promise<LibHeifInstance>;

  const factory: LibHeifFactory;
  export default factory;
}
