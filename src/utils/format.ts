/**
 * Formats byte values into human-readable strings with tabular mono clarity.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Returns the MIME type corresponding to an ImageFormat.
 */
export function getMimeType(format: string): string {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'jxl':
      return 'image/jxl';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    case 'tiff':
      return 'image/tiff';
    case 'bmp':
      return 'image/bmp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Returns appropriate file extension for download.
 */
export function getFileExtension(format: string): string {
  if (format === 'jpeg') return 'jpg';
  if (format === 'svg') return 'svg';
  return format;
}
