import { describe, it, expect } from 'vitest';
import { inspectImageDimensions } from '../metadata/dimensions';
import { decodeImage } from '../decode';

describe('Decompression Bomb Defense', () => {
  it('inspects PNG IHDR header dimensions before decoding', () => {
    // Standard PNG header (8 bytes) + IHDR (16 bytes: length=13, "IHDR", width=1920, height=1080)
    const buf = new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // PNG magic
      0x00,
      0x00,
      0x00,
      0x0d, // IHDR length (13)
      0x49,
      0x48,
      0x44,
      0x52, // "IHDR"
      0x00,
      0x00,
      0x07,
      0x80, // width = 1920
      0x00,
      0x00,
      0x04,
      0x38, // height = 1080
      0x08,
      0x06,
      0x00,
      0x00,
      0x00,
    ]).buffer;

    const dims = inspectImageDimensions(buf, 'png');
    expect(dims).not.toBeNull();
    expect(dims?.width).toBe(1920);
    expect(dims?.height).toBe(1080);
  });

  it('inspects GIF Logical Screen Descriptor dimensions before decoding', () => {
    // "GIF89a" + width 800 (0x0320) + height 600 (0x0258)
    const buf = new Uint8Array([
      0x47,
      0x49,
      0x46,
      0x38,
      0x39,
      0x61, // GIF89a
      0x20,
      0x03, // width = 800 (LE)
      0x58,
      0x02, // height = 600 (LE)
    ]).buffer;

    const dims = inspectImageDimensions(buf, 'gif');
    expect(dims).not.toBeNull();
    expect(dims?.width).toBe(800);
    expect(dims?.height).toBe(600);
  });

  it('inspects BMP DIB Header dimensions before decoding', () => {
    // "BM" (2) + size/reserved (12) + DIB header (12 bytes: size=40, width=1024, height=768)
    const buf = new Uint8Array(30);
    buf[0] = 0x42;
    buf[1] = 0x4d; // "BM"
    const view = new DataView(buf.buffer);
    view.setInt32(18, 1024, true); // width = 1024
    view.setInt32(22, 768, true); // height = 768

    const dims = inspectImageDimensions(buf.buffer, 'bmp');
    expect(dims).not.toBeNull();
    expect(dims?.width).toBe(1024);
    expect(dims?.height).toBe(768);
  });

  it('inspects WebP VP8X header dimensions before decoding', () => {
    // RIFF (4) + length (4) + WEBP (4) + VP8X (4) + chunk length (4) + flags (4) + canvas width (3) + canvas height (3)
    const buf = new Uint8Array(32);
    buf[0] = 0x52;
    buf[1] = 0x49;
    buf[2] = 0x46;
    buf[3] = 0x46; // RIFF
    buf[8] = 0x57;
    buf[9] = 0x45;
    buf[10] = 0x42;
    buf[11] = 0x50; // WEBP
    buf[12] = 0x56;
    buf[13] = 0x50;
    buf[14] = 0x38;
    buf[15] = 0x58; // VP8X
    // 24-bit width - 1 = 1279 -> 1280
    buf[24] = 0xff;
    buf[25] = 0x04;
    buf[26] = 0x00;
    // 24-bit height - 1 = 719 -> 720
    buf[27] = 0xcf;
    buf[28] = 0x02;
    buf[29] = 0x00;

    const dims = inspectImageDimensions(buf.buffer, 'webp');
    expect(dims).not.toBeNull();
    expect(dims?.width).toBe(1280);
    expect(dims?.height).toBe(720);
  });

  it('rejects image pre-decode when header dimensions exceed maxPixelCount', async () => {
    // Malicious PNG header crafted with 50,000 x 50,000 pixels (2.5 Gigapixels) in small 30-byte header
    const bombBuf = new Uint8Array([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      0x00,
      0x00,
      0x00,
      0x0d,
      0x49,
      0x48,
      0x44,
      0x52,
      0x00,
      0x00,
      0xc3,
      0x50, // 50,000 width
      0x00,
      0x00,
      0xc3,
      0x50, // 50,000 height
      0x08,
      0x06,
      0x00,
      0x00,
      0x00,
    ]).buffer;

    const result = await decodeImage(bombBuf, 'png', {
      maxFileSizeBytes: 50 * 1024 * 1024,
      maxPixelCount: 100_000_000, // 100 MP limit
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DECOMPRESSION_BOMB_LIMIT_EXCEEDED');
      expect(result.error.message).toContain('Pre-decode defense triggered');
    }
  });
});

it('inspects ISOBMFF AVIF/HEIC dimensions via ispe box before decoding', () => {
  // Construct minimal ISOBMFF container:
  // ftyp box (16 bytes): [size 16] "ftyp" "avif" [minor 0]
  // meta box (FullBox 12 bytes header + children)
  //   iprp box (8 bytes header + children)
  //     ipco box (8 bytes header + children)
  //       ispe box (20 bytes): [size 20] "ispe" [flags 0] [width 3840] [height 2160]

  const ftyp = [
    0x00,
    0x00,
    0x00,
    0x10, // size 16
    0x66,
    0x74,
    0x79,
    0x70, // 'ftyp'
    0x61,
    0x76,
    0x69,
    0x66, // 'avif'
    0x00,
    0x00,
    0x00,
    0x00, // minor version
  ];

  const ispe = [
    0x00,
    0x00,
    0x00,
    0x14, // size 20
    0x69,
    0x73,
    0x70,
    0x65, // 'ispe'
    0x00,
    0x00,
    0x00,
    0x00, // version & flags
    0x00,
    0x00,
    0x0f,
    0x00, // width = 3840
    0x00,
    0x00,
    0x08,
    0x70, // height = 2160
  ];

  const ipcoSize = 8 + ispe.length;
  const ipco = [
    0x00,
    0x00,
    0x00,
    ipcoSize,
    0x69,
    0x70,
    0x63,
    0x6f, // 'ipco'
    ...ispe,
  ];

  const iprpSize = 8 + ipco.length;
  const iprp = [
    0x00,
    0x00,
    0x00,
    iprpSize,
    0x69,
    0x70,
    0x72,
    0x70, // 'iprp'
    ...ipco,
  ];

  const metaSize = 12 + iprp.length; // FullBox has 12 byte header
  const meta = [
    0x00,
    0x00,
    0x00,
    metaSize,
    0x6d,
    0x65,
    0x74,
    0x61, // 'meta'
    0x00,
    0x00,
    0x00,
    0x00, // FullBox version + flags
    ...iprp,
  ];

  const fullFile = new Uint8Array([...ftyp, ...meta]).buffer;

  const avifDims = inspectImageDimensions(fullFile, 'avif');
  expect(avifDims).not.toBeNull();
  expect(avifDims?.width).toBe(3840);
  expect(avifDims?.height).toBe(2160);

  const heicDims = inspectImageDimensions(fullFile, 'heic');
  expect(heicDims).not.toBeNull();
  expect(heicDims?.width).toBe(3840);
  expect(heicDims?.height).toBe(2160);
});

it('rejects SVG images containing recursive XML entity definitions (billion laughs defense)', async () => {
  const maliciousSvg = `<?xml version="1.0"?>
      <!DOCTYPE lolz [
        <!ENTITY lol "lol">
        <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
      ]>
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <text>&lol2;</text>
      </svg>`;

  const buf = new TextEncoder().encode(maliciousSvg).buffer;
  const result = await decodeImage(buf, 'svg');

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe('DECODE_ERROR');
    expect(result.error.details).toContain('Custom XML entity declarations');
  }
});
