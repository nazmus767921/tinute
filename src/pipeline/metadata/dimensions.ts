import type { ImageFormat } from '../types';

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Parses ISOBMFF box tree (AVIF / HEIC) to locate 'ispe' (Image Spatial Extents) box:
 * Structure: ... -> 'meta' (full box) -> 'iprp' -> 'ipco' -> 'ispe'
 * 'ispe' contains: [length: 4][type: 4 = 'ispe'][version_flags: 4][width: 4 BE][height: 4 BE]
 */
function parseIsoBmffDimensions(buffer: ArrayBuffer): ImageDimensions | null {
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;
  if (len < 16) return null;

  const view = new DataView(buffer);

  // Scan root boxes
  let offset = 0;
  while (offset < len - 8) {
    let boxSize = view.getUint32(offset, false);
    const boxType = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    );

    if (boxSize === 1) {
      // 64-bit large box
      if (offset + 16 > len) break;
      boxSize = Number(view.getBigUint64(offset + 8, false));
      if (boxSize < 16) break;
    } else if (boxSize === 0) {
      // Extends to end of file
      boxSize = len - offset;
    }

    if (boxSize < 8 || offset + boxSize > len) break;

    if (boxType === 'meta') {
      // 'meta' is a FullBox: has 4 bytes version/flags after header (offset + 12)
      let metaOffset = offset + 12;
      const metaEnd = offset + boxSize;

      while (metaOffset < metaEnd - 8) {
        const subBoxSize = view.getUint32(metaOffset, false);
        const subBoxType = String.fromCharCode(
          bytes[metaOffset + 4]!,
          bytes[metaOffset + 5]!,
          bytes[metaOffset + 6]!,
          bytes[metaOffset + 7]!,
        );

        if (subBoxSize < 8 || metaOffset + subBoxSize > metaEnd) break;

        if (subBoxType === 'iprp') {
          // Item Property Box: contains 'ipco'
          let iprpOffset = metaOffset + 8;
          const iprpEnd = metaOffset + subBoxSize;

          while (iprpOffset < iprpEnd - 8) {
            const ipcoSize = view.getUint32(iprpOffset, false);
            const ipcoType = String.fromCharCode(
              bytes[iprpOffset + 4]!,
              bytes[iprpOffset + 5]!,
              bytes[iprpOffset + 6]!,
              bytes[iprpOffset + 7]!,
            );

            if (ipcoSize < 8 || iprpOffset + ipcoSize > iprpEnd) break;

            if (ipcoType === 'ipco') {
              // Item Property Container Box: contains array of property boxes including 'ispe'
              let ipcoOffset = iprpOffset + 8;
              const ipcoEnd = iprpOffset + ipcoSize;

              while (ipcoOffset < ipcoEnd - 8) {
                const propSize = view.getUint32(ipcoOffset, false);
                const propType = String.fromCharCode(
                  bytes[ipcoOffset + 4]!,
                  bytes[ipcoOffset + 5]!,
                  bytes[ipcoOffset + 6]!,
                  bytes[ipcoOffset + 7]!,
                );

                if (propSize < 8 || ipcoOffset + propSize > ipcoEnd) break;

                if (propType === 'ispe' && propSize >= 20) {
                  // 'ispe' has 4 bytes version/flags at ipcoOffset + 8
                  // width at ipcoOffset + 12 (4 bytes BE)
                  // height at ipcoOffset + 16 (4 bytes BE)
                  const width = view.getUint32(ipcoOffset + 12, false);
                  const height = view.getUint32(ipcoOffset + 16, false);
                  if (width > 0 && height > 0) {
                    return { width, height };
                  }
                }

                ipcoOffset += propSize;
              }
            }

            iprpOffset += ipcoSize;
          }
        }

        metaOffset += subBoxSize;
      }
    }

    offset += boxSize;
  }

  return null;
}

/**
 * Fast, lightweight binary parser that inspects container headers
 * to extract image width and height without full pixel decoding.
 * Used as a pre-decode guard against decompression bombs.
 * Supports PNG, WebP, JPEG, GIF, BMP, TIFF, AVIF, and HEIC.
 */
export function inspectImageDimensions(
  buffer: ArrayBuffer,
  format: ImageFormat,
): ImageDimensions | null {
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;
  if (len < 8) return null;

  try {
    switch (format) {
      case 'png': {
        // PNG IHDR chunk is located at byte 8-24
        // Magic (8 bytes) + IHDR length (4 bytes: 00 00 00 0D) + "IHDR" (4 bytes: 49 48 44 52)
        // Width (4 bytes BE) + Height (4 bytes BE)
        if (
          len >= 24 &&
          bytes[12] === 0x49 &&
          bytes[13] === 0x48 &&
          bytes[14] === 0x44 &&
          bytes[15] === 0x52
        ) {
          const view = new DataView(buffer);
          const width = view.getUint32(16, false);
          const height = view.getUint32(20, false);
          if (width > 0 && height > 0) return { width, height };
        }
        break;
      }

      case 'gif': {
        // GIF Logical Screen Descriptor: width at byte 6 (LE 16-bit), height at byte 8 (LE 16-bit)
        if (len >= 10) {
          const view = new DataView(buffer);
          const width = view.getUint16(6, true);
          const height = view.getUint16(8, true);
          if (width > 0 && height > 0) return { width, height };
        }
        break;
      }

      case 'bmp': {
        // BMP DIB Header at byte 14.
        // Width at byte 18 (LE 32-bit), Height at byte 22 (LE 32-bit, signed)
        if (len >= 26) {
          const view = new DataView(buffer);
          const width = view.getInt32(18, true);
          const height = Math.abs(view.getInt32(22, true));
          if (width > 0 && height > 0) return { width, height };
        }
        break;
      }

      case 'webp': {
        // RIFF (4) + Size (4) + WEBP (4) + Chunk (4)
        if (
          len >= 30 &&
          bytes[0] === 0x52 &&
          bytes[1] === 0x49 &&
          bytes[2] === 0x46 &&
          bytes[3] === 0x46
        ) {
          const chunkHeader = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);

          if (chunkHeader === 'VP8 ') {
            // Lossy WebP: keyframe header at byte 23-29
            // Frame tag (3 bytes), Start code 9D 01 2A (3 bytes at 23, 24, 25)
            // Width at 26 (14 bits), Height at 28 (14 bits)
            if (len >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
              const width = (bytes[26]! | (bytes[27]! << 8)) & 0x3fff;
              const height = (bytes[28]! | (bytes[29]! << 8)) & 0x3fff;
              if (width > 0 && height > 0) return { width, height };
            }
          } else if (chunkHeader === 'VP8L') {
            // Lossless WebP: 1 byte signature 0x2F at 20, followed by 14-bit width - 1 and 14-bit height - 1
            if (len >= 25 && bytes[20] === 0x2f) {
              const b1 = bytes[21]!;
              const b2 = bytes[22]!;
              const b3 = bytes[23]!;
              const b4 = bytes[24]!;
              const width = 1 + (((b2 & 0x3f) << 8) | b1);
              const height = 1 + ((((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)) & 0x3fff);
              if (width > 0 && height > 0) return { width, height };
            }
          } else if (chunkHeader === 'VP8X') {
            // Extended WebP: 24-bit canvas width at byte 24, height at byte 27
            if (len >= 30) {
              const width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
              const height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
              if (width > 0 && height > 0) return { width, height };
            }
          }
        }
        break;
      }

      case 'jpeg': {
        // Scan markers until SOF0 (0xFFC0), SOF1 (0xFFC1), SOF2 (0xFFC2)
        let pos = 2;
        while (pos < len - 8) {
          if (bytes[pos] !== 0xff) {
            pos++;
            continue;
          }
          const marker = bytes[pos + 1]!;
          const isSof =
            (marker >= 0xc0 && marker <= 0xc3) ||
            (marker >= 0xc5 && marker <= 0xc7) ||
            (marker >= 0xc9 && marker <= 0xcb) ||
            (marker >= 0xcd && marker <= 0xcf);

          if (isSof) {
            const view = new DataView(buffer);
            const height = view.getUint16(pos + 5, false);
            const width = view.getUint16(pos + 7, false);
            if (width > 0 && height > 0) return { width, height };
            break;
          }

          if (marker === 0xda || marker === 0xd9) break; // SOS or EOI
          const segLen = (bytes[pos + 2]! << 8) | bytes[pos + 3]!;
          if (segLen <= 0) break;
          pos += 2 + segLen;
        }
        break;
      }

      case 'tiff': {
        const isLE = bytes[0] === 0x49 && bytes[1] === 0x49;
        const view = new DataView(buffer);
        const ifdOffset = view.getUint32(4, isLE);
        if (ifdOffset >= 8 && ifdOffset + 2 <= len) {
          const numEntries = view.getUint16(ifdOffset, isLE);
          let entryPtr = ifdOffset + 2;
          let width: number | undefined;
          let height: number | undefined;

          for (let i = 0; i < numEntries; i++) {
            if (entryPtr + 12 > len) break;
            const tag = view.getUint16(entryPtr, isLE);
            const type = view.getUint16(entryPtr + 2, isLE);

            if (tag === 0x0100) {
              width =
                type === 3
                  ? view.getUint16(entryPtr + 8, isLE)
                  : view.getUint32(entryPtr + 8, isLE);
            }
            if (tag === 0x0101) {
              height =
                type === 3
                  ? view.getUint16(entryPtr + 8, isLE)
                  : view.getUint32(entryPtr + 8, isLE);
            }

            if (width !== undefined && height !== undefined) {
              return { width, height };
            }
            entryPtr += 12;
          }
        }
        break;
      }

      case 'avif':
      case 'heic': {
        return parseIsoBmffDimensions(buffer);
      }

      default:
        break;
    }
  } catch {
    return null;
  }

  return null;
}
