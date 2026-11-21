import { describe, expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';
import { bundleReport, gzipTotal } from './bundle.mjs';

describe('gzipTotal', () => {
  it('各応答を gzip（レベル 9）して足す', () => {
    const a = Buffer.from('a'.repeat(5000));
    const b = Buffer.from('console.log(1);'.repeat(300));
    expect(gzipTotal([a, b])).toBe(
      gzipSync(a, { level: 9 }).length + gzipSync(b, { level: 9 }).length,
    );
  });
  it('応答が無いと 0', () => {
    expect(gzipTotal([])).toBe(0);
  });
});

describe('bundleReport', () => {
  it('基準以内なら bundle の行だけを出して 0', () => {
    expect(bundleReport(170000)).toEqual({
      lines: ['bundle: initial js gzip=170000 limit=170000'],
      code: 0,
    });
  });
  it('基準を 1 バイト超えると perf: FAIL の行を足して 1', () => {
    expect(bundleReport(170001)).toEqual({
      lines: [
        'bundle: initial js gzip=170001 limit=170000',
        'perf: FAIL initialJsGzipBytes / 170001 > 170000',
      ],
      code: 1,
    });
  });
});
