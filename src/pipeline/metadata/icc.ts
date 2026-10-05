import { unzlibSync } from 'fflate';
import type { RawImage } from '../../codecs/types';
import type { LcmsInstance } from 'lcms-wasm';

export interface IccProfileInfo {
  name: string;
  colorSpace: 'srgb' | 'display-p3' | 'adobe-rgb' | 'other';
  rawProfileBytes?: Uint8Array;
}

let lcmsPromise: Promise<{
  lcms: LcmsInstance;
  TYPE_RGB_8: number;
  INTENT_PERCEPTUAL: number;
}> | null = null;

async function ensureLcms(): Promise<{
  lcms: LcmsInstance;
  TYPE_RGB_8: number;
  INTENT_PERCEPTUAL: number;
}> {
  if (!lcmsPromise) {
    lcmsPromise = (async () => {
      let wasmBinary: ArrayBuffer;
      if (typeof process !== 'undefined' && process.versions?.node) {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const wasmPath = path.resolve(process.cwd(), 'public', 'wasm', 'lcms.wasm');
        const buf = fs.readFileSync(wasmPath);
        wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      } else {
        const response = await fetch('/wasm/lcms.wasm');
        wasmBinary = await response.arrayBuffer();
      }

      const lcmsModule = await import('lcms-wasm');
      const lcms = await lcmsModule.instantiate({ wasmBinary });
      return {
        lcms,
        TYPE_RGB_8: lcmsModule.TYPE_RGB_8,
        INTENT_PERCEPTUAL: lcmsModule.INTENT_PERCEPTUAL,
      };
    })();
  }
  return lcmsPromise;
}

/**
 * Extracts human-readable profile description and classifies color space from raw ICC profile.
 */
export function inspectIccProfile(bytes: Uint8Array): IccProfileInfo {
  if (bytes.length < 128) {
    return { name: 'sRGB', colorSpace: 'srgb' };
  }

  // Check ICC magic bytes 'acsp' at offset 36
  if (
    bytes[36] !== 0x61 || // 'a'
    bytes[37] !== 0x63 || // 'c'
    bytes[38] !== 0x73 || // 's'
    bytes[39] !== 0x70 // 'p'
  ) {
    return { name: 'sRGB', colorSpace: 'srgb' };
  }

  // Scan for 'desc' tag in tag table
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tagCount = view.getUint32(128, false);
  let name = 'Unknown ICC Profile';
  let colorSpace: IccProfileInfo['colorSpace'] = 'srgb';

  let ptr = 132;
  for (let i = 0; i < tagCount && ptr + 12 <= bytes.length; i++) {
    const tagSig = String.fromCharCode(
      bytes[ptr]!,
      bytes[ptr + 1]!,
      bytes[ptr + 2]!,
      bytes[ptr + 3]!,
    );
    const offset = view.getUint32(ptr + 4, false);
    const length = view.getUint32(ptr + 8, false);

    if (tagSig === 'desc' && offset + length <= bytes.length) {
      const typeSig = String.fromCharCode(
        bytes[offset]!,
        bytes[offset + 1]!,
        bytes[offset + 2]!,
        bytes[offset + 3]!,
      );

      if (typeSig === 'desc' && offset + 12 <= bytes.length) {
        const strLen = view.getUint32(offset + 8, false);
        if (strLen > 0 && offset + 12 + strLen <= bytes.length) {
          const strBytes = bytes.slice(offset + 12, offset + 12 + strLen);
          name = new TextDecoder().decode(strBytes).replace(/\0+$/, '').trim();
        }
      } else if (typeSig === 'mluc' && offset + 28 <= bytes.length) {
        const strLen = view.getUint32(offset + 20, false);
        const strOffset = view.getUint32(offset + 24, false);
        if (strLen > 0 && offset + strOffset + strLen <= bytes.length) {
          const strBytes = bytes.slice(offset + strOffset, offset + strOffset + strLen);
          name = new TextDecoder('utf-16be').decode(strBytes).replace(/\0+$/, '').trim();
        }
      }
      break;
    }
    ptr += 12;
  }

  const lowerName = name.toLowerCase();
  if (lowerName.includes('p3') || lowerName.includes('display p3')) {
    colorSpace = 'display-p3';
  } else if (lowerName.includes('adobe') || lowerName.includes('argb')) {
    colorSpace = 'adobe-rgb';
  } else if (lowerName.includes('srgb') || lowerName.includes('iec61966')) {
    colorSpace = 'srgb';
  } else {
    colorSpace = 'other';
  }

  return {
    name,
    colorSpace,
    rawProfileBytes: bytes,
  };
}

/**
 * Extracts ICC Profile from image file buffers (JPEG, PNG, WebP, TIFF).
 */
export function extractIccProfile(buffer: ArrayBuffer): IccProfileInfo | null {
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;

  // 1. JPEG: APP2 marker with "ICC_PROFILE\0"
  if (len >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let pos = 2;
    const iccChunks: { seq: number; total: number; data: Uint8Array }[] = [];

    while (pos < len - 4) {
      if (bytes[pos] !== 0xff) {
        pos++;
        continue;
      }
      const marker = bytes[pos + 1]!;
      if (marker === 0xda || marker === 0xd9) break;

      const segLen = (bytes[pos + 2]! << 8) | bytes[pos + 3]!;
      if (marker === 0xe2 && segLen > 14) {
        const header = new TextDecoder().decode(bytes.subarray(pos + 4, pos + 16));
        if (header.startsWith('ICC_PROFILE\0')) {
          const seq = bytes[pos + 16]!;
          const total = bytes[pos + 17]!;
          const chunkData = bytes.slice(pos + 18, pos + 2 + segLen);
          iccChunks.push({ seq, total, data: chunkData });
        }
      }
      pos += 2 + segLen;
    }

    if (iccChunks.length > 0) {
      iccChunks.sort((a, b) => a.seq - b.seq);
      const totalLen = iccChunks.reduce((acc, c) => acc + c.data.length, 0);
      const fullIcc = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of iccChunks) {
        fullIcc.set(chunk.data, offset);
        offset += chunk.data.length;
      }
      return inspectIccProfile(fullIcc);
    }
  }

  // 2. PNG: 'iCCP' chunk
  if (
    len >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    let pos = 8;
    const view = new DataView(buffer);
    while (pos < len - 12) {
      const chunkLen = view.getUint32(pos, false);
      const chunkType = String.fromCharCode(
        bytes[pos + 4]!,
        bytes[pos + 5]!,
        bytes[pos + 6]!,
        bytes[pos + 7]!,
      );

      if (chunkType === 'iCCP') {
        const chunkData = bytes.subarray(pos + 8, pos + 8 + chunkLen);
        let nullIdx = 0;
        while (nullIdx < chunkData.length && chunkData[nullIdx] !== 0) nullIdx++;
        if (nullIdx + 2 < chunkData.length) {
          const compressed = chunkData.subarray(nullIdx + 2);
          try {
            const decompressed = unzlibSync(compressed);
            return inspectIccProfile(decompressed);
          } catch {
            // Deflate fallback failure: ignore corrupted chunk
          }
        }
      }
      pos += 12 + chunkLen;
    }
  }

  // 3. WebP: 'ICCP' chunk
  if (
    len >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    let pos = 12;
    const view = new DataView(buffer);
    while (pos < len - 8) {
      const chunkType = String.fromCharCode(
        bytes[pos]!,
        bytes[pos + 1]!,
        bytes[pos + 2]!,
        bytes[pos + 3]!,
      );
      const chunkLen = view.getUint32(pos + 4, true);
      if (chunkType === 'ICCP') {
        const iccBytes = bytes.slice(pos + 8, pos + 8 + chunkLen);
        return inspectIccProfile(iccBytes);
      }
      pos += 8 + chunkLen + (chunkLen % 2);
    }
  }

  return null;
}

// Precomputed sRGB gamma lookup tables
const TO_LINEAR_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  TO_LINEAR_LUT[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function toGamma(linear: number): number {
  const c = Math.max(0, Math.min(1, linear));
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055;
  return Math.round(v * 255);
}

/**
 * Normalizes wide-gamut (e.g. Display P3) pixel buffer into working sRGB color space
 * using LittleCMS WebAssembly with fast analytical matrix fallback.
 * Preserves alpha channel bit-for-bit.
 */
export async function normalizeColorSpace(
  image: RawImage,
  profile: IccProfileInfo | null,
): Promise<RawImage> {
  if (!profile || profile.colorSpace === 'srgb') {
    return image;
  }

  // 1. LittleCMS WebAssembly transformation when raw ICC profile bytes are available
  if (profile.rawProfileBytes && profile.rawProfileBytes.length > 0) {
    try {
      const { lcms, TYPE_RGB_8, INTENT_PERCEPTUAL } = await ensureLcms();
      const inProfile = lcms.cmsOpenProfileFromMem(
        profile.rawProfileBytes,
        profile.rawProfileBytes.length,
      );

      if (inProfile !== 0) {
        const outProfile = lcms.cmsCreate_sRGBProfile();
        if (outProfile !== 0) {
          const transform = lcms.cmsCreateTransform(
            inProfile,
            TYPE_RGB_8,
            outProfile,
            TYPE_RGB_8,
            INTENT_PERCEPTUAL,
            0,
          );

          if (transform !== 0) {
            const pixelCount = image.width * image.height;
            const rgbIn = new Uint8Array(pixelCount * 3);
            const src = image.data;

            for (let i = 0, p = 0; i < src.length; i += 4, p += 3) {
              rgbIn[p] = src[i]!;
              rgbIn[p + 1] = src[i + 1]!;
              rgbIn[p + 2] = src[i + 2]!;
            }

            const rgbOut = lcms.cmsDoTransform(transform, rgbIn, pixelCount);
            const dst = new Uint8ClampedArray(src.length);

            for (let i = 0, p = 0; i < src.length; i += 4, p += 3) {
              dst[i] = rgbOut[p]!;
              dst[i + 1] = rgbOut[p + 1]!;
              dst[i + 2] = rgbOut[p + 2]!;
              dst[i + 3] = src[i + 3]!; // Exact alpha preserved
            }

            lcms.cmsDeleteTransform(transform);
            lcms.cmsCloseProfile(inProfile);
            lcms.cmsCloseProfile(outProfile);

            return {
              width: image.width,
              height: image.height,
              data: dst,
            };
          }
          lcms.cmsCloseProfile(outProfile);
        }
        lcms.cmsCloseProfile(inProfile);
      }
    } catch {
      // Fallback to high-precision matrix transform below
    }
  }

  // 2. High-precision analytical Display P3 to sRGB fallback
  if (profile.colorSpace === 'display-p3') {
    const data = image.data;
    const out = new Uint8ClampedArray(data.length);

    for (let i = 0; i < data.length; i += 4) {
      const rLin = TO_LINEAR_LUT[data[i]!]!;
      const gLin = TO_LINEAR_LUT[data[i + 1]!]!;
      const bLin = TO_LINEAR_LUT[data[i + 2]!]!;
      const a = data[i + 3]!;

      const rSrgb = 1.22494 * rLin - 0.22494 * gLin;
      const gSrgb = -0.04206 * rLin + 1.04206 * gLin;
      const bSrgb = -0.01964 * rLin - 0.07864 * gLin + 1.09827 * bLin;

      out[i] = toGamma(rSrgb);
      out[i + 1] = toGamma(gSrgb);
      out[i + 2] = toGamma(bSrgb);
      out[i + 3] = a; // Exact alpha preserved
    }

    return {
      width: image.width,
      height: image.height,
      data: out,
    };
  }

  return image;
}
