import { describe, expect, it } from 'vitest';
import { toMeasurements } from './lighthouse.mjs';
import { table } from './run.mjs';

describe('toMeasurements', () => {
  it('3 回の点数・LCP・CLS をそれぞれ中央値にする', () => {
    const rows = toMeasurements('/demo', [
      { score: 88, lcpMs: 2000, cls: 0.02 },
      { score: 95, lcpMs: 3000, cls: 0 },
      { score: 91, lcpMs: 2400, cls: 0.5 },
    ]);
    expect(rows).toEqual([
      { indicator: 'lighthouseScore', screen: '/demo', value: 91 },
      { indicator: 'lcpMs', screen: '/demo', value: 2400 },
      { indicator: 'cls', screen: '/demo', value: 0.02 },
    ]);
  });
});

describe('table', () => {
  it('指標・画面・値・基準の表にする', () => {
    expect(table([{ indicator: 'inpMs', screen: '/', value: 120 }])).toBe(
      ['| 指標 | 画面 | 値 | 基準 |', '|---|---|---|---|', '| inpMs | / | 120 | 200 |'].join('\n'),
    );
  });
});
