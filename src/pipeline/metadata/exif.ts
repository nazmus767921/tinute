export interface ExifInfo {
  orientation: number; // 1-8
  hasGps: boolean;
  make?: string;
  model?: string;
  software?: string;
  rawExifBytes?: Uint8Array;
}

/**
 * Parses raw TIFF-formatted EXIF data block (starting at TIFF header 'II' or 'MM').
 */
export function parseTiffExif(buffer: Uint8Array, offset = 0): ExifInfo {
  const result: ExifInfo = {
    orientation: 1,
    hasGps: false,
  };

  if (buffer.length - offset < 8) {
    return result;
  }

  const isLittleEndian = buffer[offset] === 0x49 && buffer[offset + 1] === 0x49; // 'II'
  const isBigEndian = buffer[offset] === 0x4d && buffer[offset + 1] === 0x4d; // 'MM'

  if (!isLittleEndian && !isBigEndian) {
    return result;
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset + offset, buffer.byteLength - offset);
  const magic = view.getUint16(2, isLittleEndian);
  if (magic !== 42 && magic !== 0x2a) {
    return result;
  }

  const ifd0Offset = view.getUint32(4, isLittleEndian);
  if (ifd0Offset < 8 || ifd0Offset + 2 > view.byteLength) {
    return result;
  }

  const numEntries = view.getUint16(ifd0Offset, isLittleEndian);
  let entryPtr = ifd0Offset + 2;

  for (let i = 0; i < numEntries; i++) {
    if (entryPtr + 12 > view.byteLength) break;

    const tag = view.getUint16(entryPtr, isLittleEndian);
    const type = view.getUint16(entryPtr + 2, isLittleEndian);
    const count = view.getUint32(entryPtr + 4, isLittleEndian);

    // Orientation (Tag 0x0112 / 274)
    if (tag === 0x0112) {
      const val =
        type === 3
          ? view.getUint16(entryPtr + 8, isLittleEndian)
          : view.getUint32(entryPtr + 8, isLittleEndian);
      if (val >= 1 && val <= 8) {
        result.orientation = val;
      }
    }

    // GPS Info IFD Pointer (Tag 0x8825 / 34853)
    if (tag === 0x8825) {
      result.hasGps = true;
    }

    // Make (Tag 0x010F / 271)
    if (tag === 0x010f && type === 2 && count > 0 && count < 256) {
      const strOffset = view.getUint32(entryPtr + 8, isLittleEndian);
      if (strOffset + count <= view.byteLength) {
        const chars = new Uint8Array(buffer.buffer, buffer.byteOffset + offset + strOffset, count);
        result.make = new TextDecoder().decode(chars).replace(/\0+$/, '').trim();
      }
    }

    // Model (Tag 0x0110 / 272)
    if (tag === 0x0110 && type === 2 && count > 0 && count < 256) {
      const strOffset = view.getUint32(entryPtr + 8, isLittleEndian);
      if (strOffset + count <= view.byteLength) {
        const chars = new Uint8Array(buffer.buffer, buffer.byteOffset + offset + strOffset, count);
        result.model = new TextDecoder().decode(chars).replace(/\0+$/, '').trim();
      }
    }

    // Software (Tag 0x0131 / 305)
    if (tag === 0x0131 && type === 2 && count > 0 && count < 256) {
      const strOffset = view.getUint32(entryPtr + 8, isLittleEndian);
      if (strOffset + count <= view.byteLength) {
        const chars = new Uint8Array(buffer.buffer, buffer.byteOffset + offset + strOffset, count);
        result.software = new TextDecoder().decode(chars).replace(/\0+$/, '').trim();
      }
    }

    entryPtr += 12;
  }

  return result;
}

/**
 * Extracts EXIF block from standard image container formats (JPEG, PNG, WebP, TIFF).
 */
export function extractExif(buffer: ArrayBuffer): ExifInfo {
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;

  // 1. JPEG: APP1 marker (FF E1 [len] "Exif\0\0" [TIFF header])
  if (len >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let pos = 2;
    while (pos < len - 4) {
      if (bytes[pos] !== 0xff) {
        pos++;
        continue;
      }
      const marker = bytes[pos + 1]!;
      if (marker === 0xda || marker === 0xd9) break; // SOS or EOI

      const segLen = (bytes[pos + 2]! << 8) | bytes[pos + 3]!;
      if (marker === 0xe1 && segLen > 8) {
        // Check "Exif\0\0"
        if (
          bytes[pos + 4] === 0x45 && // E
          bytes[pos + 5] === 0x78 && // x
          bytes[pos + 6] === 0x69 && // i
          bytes[pos + 7] === 0x66 && // f
          bytes[pos + 8] === 0x00 &&
          bytes[pos + 9] === 0x00
        ) {
          const tiffStart = pos + 10;
          const exif = parseTiffExif(bytes, tiffStart);
          exif.rawExifBytes = bytes.slice(pos + 4, pos + 2 + segLen);
          return exif;
        }
      }
      pos += 2 + segLen;
    }
  }

  // 2. PNG: 'eXIf' chunk
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
      if (chunkType === 'eXIf') {
        const exif = parseTiffExif(bytes, pos + 8);
        exif.rawExifBytes = bytes.slice(pos + 8, pos + 8 + chunkLen);
        return exif;
      }
      pos += 12 + chunkLen;
    }
  }

  // 3. WebP: 'EXIF' chunk in RIFF container
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
      if (chunkType === 'EXIF') {
        const exif = parseTiffExif(bytes, pos + 8);
        exif.rawExifBytes = bytes.slice(pos + 8, pos + 8 + chunkLen);
        return exif;
      }
      pos += 8 + chunkLen + (chunkLen % 2); // WebP chunks are padded to even boundary
    }
  }

  // 4. TIFF: Directly at offset 0
  if (
    len >= 8 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4d && bytes[1] === 0x4d))
  ) {
    const exif = parseTiffExif(bytes, 0);
    exif.rawExifBytes = bytes.slice(0, Math.min(len, 65536));
    return exif;
  }

  return {
    orientation: 1,
    hasGps: false,
  };
}
