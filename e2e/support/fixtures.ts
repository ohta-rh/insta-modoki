import type { Page } from '@playwright/test';

/** A JPEG made by the browser's own encoder: `width` x `height`, a gradient with a few shapes. */
export async function makeJpeg(page: Page, width: number, height: number): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ([w, h]) => {
      const canvas = document.createElement('canvas');
      canvas.width = w!;
      canvas.height = h!;
      const ctx = canvas.getContext('2d')!;
      const g = ctx.createLinearGradient(0, 0, w!, h!);
      g.addColorStop(0, '#d33');
      g.addColorStop(1, '#36c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w!, h!);
      ctx.fillStyle = '#fc0';
      ctx.fillRect(w! / 4, h! / 4, w! / 2, h! / 2);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.8),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (const b of bytes) s += String.fromCharCode(b);
      return btoa(s);
    },
    [width, height],
  );
  return Buffer.from(base64, 'base64');
}

const u16 = (n: number) => Buffer.from([n & 0xff, (n >> 8) & 0xff]);
const u32 = (n: number) =>
  Buffer.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]);
const entry = (tag: number, type: number, count: number, value: Buffer) =>
  Buffer.concat([u16(tag), u16(type), u32(count), value]);

/** An Exif APP1 segment (little endian) with a GPS IFD: 35 deg N, 139 deg E. */
function gpsExifSegment(): Buffer {
  // TIFF: header(8) + IFD0 (1 entry: GPS pointer) + GPS IFD (4 entries) + rational data.
  const ifd0Size = 2 + 12 + 4;
  const gpsOffset = 8 + ifd0Size;
  const gpsSize = 2 + 4 * 12 + 4;
  const dataOffset = gpsOffset + gpsSize;
  const rationals = (deg: number) =>
    Buffer.concat([u32(deg), u32(1), u32(0), u32(1), u32(0), u32(1)]);
  const gps = Buffer.concat([
    u16(4),
    entry(0x0001, 2, 2, Buffer.from('N\0\0\0')),
    entry(0x0002, 5, 3, u32(dataOffset)),
    entry(0x0003, 2, 2, Buffer.from('E\0\0\0')),
    entry(0x0004, 5, 3, u32(dataOffset + 24)),
    u32(0),
  ]);
  const tiff = Buffer.concat([
    Buffer.from('II'),
    u16(42),
    u32(8),
    u16(1),
    entry(0x8825, 4, 1, u32(gpsOffset)),
    u32(0),
    gps,
    rationals(35),
    rationals(139),
  ]);
  const body = Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
  return Buffer.concat([
    Buffer.from([0xff, 0xe1]),
    Buffer.from([(body.length + 2) >> 8, (body.length + 2) & 0xff]),
    body,
  ]);
}

/** The JPEG with a GPS Exif segment right after SOI. */
export function withGps(jpeg: Buffer): Buffer {
  return Buffer.concat([jpeg.subarray(0, 2), gpsExifSegment(), jpeg.subarray(2)]);
}

/** The chunk ids of a RIFF WebP, in order. */
function webpChunks(bytes: Buffer): string[] {
  const ids: string[] = [];
  for (let at = 12; at + 8 <= bytes.length;) {
    ids.push(bytes.toString('ascii', at, at + 4));
    at += 8 + bytes.readUInt32LE(at + 4) + (bytes.readUInt32LE(at + 4) % 2);
  }
  return ids;
}

/** Whether the file carries Exif (a JPEG APP1 Exif segment, or a WebP `EXIF` / `XMP ` chunk). */
export function hasExif(bytes: Buffer): boolean {
  if (bytes.toString('ascii', 0, 4) === 'RIFF') {
    return webpChunks(bytes).some((id) => id === 'EXIF' || id === 'XMP ');
  }
  return bytes.includes(Buffer.from('Exif\0\0'));
}

/** A JPEG padded with zero bytes after the end marker to exactly `size` bytes. */
export function padTo(jpeg: Buffer, size: number): Buffer {
  return Buffer.concat([jpeg, Buffer.alloc(size - jpeg.length)]);
}

/** The pixel size stored in a WebP (`VP8X` extended header or a lossy `VP8 ` chunk), or null. */
export function webpSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP')
    return null;
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  }
  if (chunk === 'VP8 ') {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  return null;
}
