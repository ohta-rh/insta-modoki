import { describe, expect, it } from 'vitest';
import { evaluate, formatViolation, THRESHOLDS } from './thresholds.mjs';

// [indicator, limit, one past the limit]. lighthouseScore is a floor, the others are ceilings.
const cases: [keyof typeof THRESHOLDS, number, number][] = [
  ['lighthouseScore', 90, 89],
  ['lcpMs', 2500, 2501],
  ['inpMs', 200, 201],
  ['cls', 0.1, 0.11],
  ['feedApiP95Ms', 300, 301],
  ['initialJsGzipBytes', 170000, 170001],
];

describe('THRESHOLDS', () => {
  it('企画書の基準と同じ', () => {
    expect(THRESHOLDS).toEqual({
      lighthouseScore: 90,
      lcpMs: 2500,
      inpMs: 200,
      cls: 0.1,
      feedApiP95Ms: 300,
      initialJsGzipBytes: 170000,
    });
  });
});

describe('evaluate', () => {
  for (const [indicator, limit, past] of cases) {
    it(`${indicator} が基準ちょうどのとき通る`, () => {
      expect(evaluate([{ indicator, screen: '/', value: limit }])).toEqual([]);
    });
    it(`${indicator} が基準を 1 つ超えると落ちる`, () => {
      expect(evaluate([{ indicator, screen: '/', value: past }])).toEqual([
        { indicator, screen: '/', value: past, limit },
      ]);
    });
  }

  it('割れた指標だけを、画面ごとに返す', () => {
    const v = evaluate([
      { indicator: 'lcpMs', screen: '/', value: 100 },
      { indicator: 'lcpMs', screen: '/demo', value: 3000 },
    ]);
    expect(v.map((x: { screen: string }) => x.screen)).toEqual(['/demo']);
  });

  it('知らない指標は投げる', () => {
    expect(() => evaluate([{ indicator: 'nope', screen: '/', value: 1 }])).toThrow(/nope/);
  });
});

describe('formatViolation', () => {
  it('上限の指標は > で、点数は < で出す', () => {
    expect(formatViolation({ indicator: 'lcpMs', screen: '/', value: 2501, limit: 2500 })).toBe(
      'perf: FAIL lcpMs / 2501 > 2500',
    );
    expect(
      formatViolation({ indicator: 'lighthouseScore', screen: '/demo', value: 89, limit: 90 }),
    ).toBe('perf: FAIL lighthouseScore /demo 89 < 90');
    expect(
      formatViolation({
        indicator: 'initialJsGzipBytes',
        screen: '/',
        value: 380000,
        limit: 170000,
      }),
    ).toBe('perf: FAIL initialJsGzipBytes / 380000 > 170000');
  });
});
