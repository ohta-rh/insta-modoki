import { MAX_BOX_HEADERS, MAX_MOOV_BYTES } from './limits';

export type Mp4Info = { durationMs: number; width: number; height: number };
type Read = (offset: number, length: number) => Promise<Uint8Array>;
type BoxHeader = { type: string; size: number; headerLength: number };

const ascii = (b: Uint8Array, at: number): string => String.fromCharCode(...b.subarray(at, at + 4));

/**
 * The box header at `at`: size (4 bytes; 1 = the next 8 bytes are the size; 0 = to `end`) and
 * type. Null when the bytes run out or the size is smaller than the header.
 */
function header(bytes: Uint8Array, at: number, end: number): BoxHeader | null {
  if (at + 8 > bytes.length) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = ascii(bytes, at + 4);
  let size = view.getUint32(at);
  let headerLength = 8;
  if (size === 1) {
    if (at + 16 > bytes.length) return null;
    size = Number(view.getBigUint64(at + 8));
    headerLength = 16;
  } else if (size === 0) {
    size = end - at;
  }
  if (!Number.isSafeInteger(size) || size < headerLength) return null;
  return { type, size, headerLength };
}

/** The first child box of `type` inside bytes[from, to), or null. */
function child(bytes: Uint8Array, from: number, to: number, type: string, nth = 0) {
  let seen = 0;
  for (let at = from; at < to;) {
    const h = header(bytes, at, to);
    if (h === null || at + h.size > to) return null;
    if (h.type === type && seen++ === nth) {
      return { start: at + h.headerLength, end: at + h.size };
    }
    at += h.size;
  }
  return null;
}

/** The pixel size in a `tkhd` (the last 8 bytes: 16.16 fixed point), or null when it has none. */
function trackSize(view: DataView, start: number, end: number) {
  if (end - start < 8) return null;
  const width = view.getUint32(end - 8) >>> 16;
  const height = view.getUint32(end - 4) >>> 16;
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * Reads the length and the pixel size of an MP4 from its boxes, with no decoder: it skips at
 * most 16 top-level box headers to find `moov` (which may come after `mdat`), reads it once
 * (at most 1 MiB), and takes the duration from `mvhd` and the size from the first `tkhd` that has one.
 * Null when the file cannot be read that way. The browser and the server both call this.
 */
export async function readMp4Info(read: Read, size: number): Promise<Mp4Info | null> {
  let at = 0;
  for (let i = 0; i < MAX_BOX_HEADERS && at + 8 <= size; i += 1) {
    const head = await read(at, 16);
    const h = header(head, 0, size - at);
    if (h === null) return null;
    if (h.type !== 'moov') {
      at += h.size;
      continue;
    }
    if (h.size > MAX_MOOV_BYTES || at + h.size > size) return null;
    const bytes = await read(at, h.size);
    if (bytes.length < h.size) return null;
    return parseMoov(bytes, h.headerLength);
  }
  return null;
}

function parseMoov(bytes: Uint8Array, headerLength: number): Mp4Info | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const mvhd = child(bytes, headerLength, bytes.length, 'mvhd');
  if (mvhd === null || mvhd.end - mvhd.start < 20) return null;
  const version = bytes[mvhd.start];
  let timescale: number;
  let duration: number;
  if (version === 1) {
    if (mvhd.end - mvhd.start < 32) return null;
    timescale = view.getUint32(mvhd.start + 20);
    duration = Number(view.getBigUint64(mvhd.start + 24));
  } else {
    timescale = view.getUint32(mvhd.start + 12);
    duration = view.getUint32(mvhd.start + 16);
  }
  if (timescale === 0) return null;

  for (let n = 0; ; n += 1) {
    const trak = child(bytes, headerLength, bytes.length, 'trak', n);
    if (trak === null) return null;
    const tkhd = child(bytes, trak.start, trak.end, 'tkhd');
    const px = tkhd && trackSize(view, tkhd.start, tkhd.end);
    if (px) return { durationMs: Math.round((duration * 1000) / timescale), ...px };
  }
}
