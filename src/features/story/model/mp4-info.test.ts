import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { box, buildMp4, concat, moov, mvhd, readerOf, tkhd } from '../../../../tests/helpers/mp4';
import { readMp4Info } from './mp4-info';

const base = { timescale: 1000, duration: 15_000, width: 320, height: 568 };
const info = (bytes: Uint8Array) => readMp4Info(readerOf(bytes).read, bytes.length);

describe('readMp4Info', () => {
  it('mvhd と tkhd から長さと画素を返す（version 0 と 1）', async () => {
    for (const version of [0, 1] as const) {
      for (const moovLast of [false, true]) {
        const bytes = buildMp4({ ...base, version, moovLast });
        expect(await info(bytes)).toEqual({ durationMs: 15_000, width: 320, height: 568 });
      }
    }
    // The duration is rounded from the timescale.
    expect(await info(buildMp4({ ...base, timescale: 600, duration: 9001 }))).toMatchObject({
      durationMs: 15_002,
    });
    // A 64-bit box size (size = 1) and a last box that runs to the end (size = 0) are walked.
    const wide = concat(
      new Uint8Array([0, 0, 0, 1, 0x66, 0x72, 0x65, 0x65, 0, 0, 0, 0, 0, 0, 0, 16]),
      moov(base),
    );
    expect(await info(wide)).toMatchObject({ durationMs: 15_000 });
    const toEnd = moov(base);
    toEnd.set([0, 0, 0, 0], 0);
    expect(await info(toEnd)).toMatchObject({ durationMs: 15_000 });
  });

  it('幅と高さが 0 の trak は飛ばし 次の trak の画素を返す', async () => {
    const bytes = concat(
      box('moov', mvhd(base), box('trak', tkhd({ width: 0, height: 0 })), box('trak', tkhd(base))),
    );
    expect(await info(bytes)).toEqual({ durationMs: 15_000, width: 320, height: 568 });
  });

  it('読めない形のとき null を返す', async () => {
    const free = box('free', new Uint8Array(4));
    const cases: Record<string, Uint8Array> = {
      empty: new Uint8Array(0),
      'no moov': concat(box('ftyp', new Uint8Array(8)), box('mdat', new Uint8Array(8))),
      'moov after 16 boxes': concat(...Array.from({ length: 16 }, () => free), moov(base)),
      'zero width': buildMp4({ ...base, width: 0 }),
      'zero height': buildMp4({ ...base, height: 0 }),
      'zero timescale': buildMp4({ ...base, timescale: 0 }),
      'no trak': box('moov', mvhd(base)),
      'no mvhd': box('moov', box('trak', tkhd(base))),
      'box smaller than its header': new Uint8Array([0, 0, 0, 4, 0x6d, 0x6f, 0x6f, 0x76]),
      truncated: buildMp4(base).slice(0, 60),
    };
    for (const [name, bytes] of Object.entries(cases)) {
      expect(await info(bytes), name).toBeNull();
    }
    // The 16th box is still looked at.
    const sixteenth = concat(...Array.from({ length: 15 }, () => free), moov(base));
    expect(await info(sixteenth)).not.toBeNull();
  });

  it('moov が 1,048,576 バイトを超えるとき読まずに null を返す', async () => {
    const big = new Uint8Array(1_048_576 - 8 + 1);
    const m = box('moov', big);
    const reader = readerOf(m);
    expect(await readMp4Info(reader.read, m.length)).toBeNull();
    expect(reader.calls.every(([, length]) => length <= 16)).toBe(true);
    const fits = readerOf(box('moov', new Uint8Array(1_048_576 - 8)));
    await readMp4Info(fits.read, 1_048_576);
    expect(fits.calls.some(([, length]) => length === 1_048_576)).toBe(true);
  });

  it('E2E の動画の素材の長さを 5,000・15,000・16,000 ms と読む', async () => {
    for (const [name, ms] of [
      ['story-5s.mp4', 5000],
      ['story-15s.mp4', 15_000],
      ['story-16s.mp4', 16_000],
    ] as const) {
      const bytes = new Uint8Array(readFileSync(join(process.cwd(), 'e2e/fixtures', name)));
      expect(await info(bytes), name).toMatchObject({ durationMs: ms, width: 320, height: 568 });
    }
  });
});
