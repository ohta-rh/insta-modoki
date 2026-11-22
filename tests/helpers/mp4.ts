// Builds the bytes of a minimal MP4 for tests: only the boxes `readMp4Info` reads are filled.
export type Mp4Options = {
  version?: 0 | 1;
  timescale: number;
  duration: number;
  width: number;
  height: number;
  /** Put `moov` after `mdat` (a file that was not made for streaming). */
  moovLast?: boolean;
};

const u32 = (n: number): Uint8Array => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
};
const u64 = (n: number): Uint8Array => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n));
  return b;
};

export function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** A box: 4-byte size, 4-char type, payload. */
export function box(type: string, ...payload: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const body = concat(...payload);
  return concat(u32(8 + body.length), new TextEncoder().encode(type), body);
}

const zeros = (n: number) => new Uint8Array(n);

export function mvhd(o: Pick<Mp4Options, 'version' | 'timescale' | 'duration'>) {
  if (o.version === 1) {
    return box(
      'mvhd',
      new Uint8Array([1, 0, 0, 0]),
      zeros(16),
      u32(o.timescale),
      u64(o.duration),
      zeros(80),
    );
  }
  return box(
    'mvhd',
    new Uint8Array([0, 0, 0, 0]),
    zeros(8),
    u32(o.timescale),
    u32(o.duration),
    zeros(80),
  );
}

/** `width` and `height` are whole pixels; they are stored as 16.16 fixed point at the end. */
export function tkhd(o: Pick<Mp4Options, 'version' | 'width' | 'height'>) {
  const dims = concat(u32(o.width * 65536), u32(o.height * 65536));
  return o.version === 1
    ? box('tkhd', new Uint8Array([1, 0, 0, 0]), zeros(84), dims)
    : box('tkhd', new Uint8Array([0, 0, 0, 0]), zeros(72), dims);
}

export function moov(o: Mp4Options): Uint8Array<ArrayBuffer> {
  return box('moov', mvhd(o), box('trak', tkhd(o)));
}

export function buildMp4(o: Mp4Options): Uint8Array<ArrayBuffer> {
  const ftyp = box(
    'ftyp',
    new TextEncoder().encode('isom'),
    zeros(4),
    new TextEncoder().encode('isom'),
  );
  const mdat = box('mdat', zeros(32));
  return o.moovLast ? concat(ftyp, mdat, moov(o)) : concat(ftyp, moov(o), mdat);
}

/** A reader over `bytes`, like `getRange`: it returns fewer bytes at the end of the data. */
export function readerOf(bytes: Uint8Array) {
  const calls: [number, number][] = [];
  const read = async (offset: number, length: number) => {
    calls.push([offset, length]);
    return bytes.slice(offset, offset + length);
  };
  return { read, calls };
}
