import { describe, expect, it } from 'vitest';
import { msUntilFreshWindow, ownIpLastOctet } from './rate-window';

const WINDOW = 60;

describe('msUntilFreshWindow', () => {
  it('窓の残りが必要な秒数より多いとき 0 を返す', () => {
    expect(msUntilFreshWindow(0, WINDOW, 20)).toBe(0);
    expect(msUntilFreshWindow(30_000, WINDOW, 20)).toBe(0);
  });

  it('窓の残りが必要な秒数より少ないとき 次の窓までのミリ秒を返す', () => {
    expect(msUntilFreshWindow(57_000, WINDOW, 20)).toBe(3_000);
    expect(msUntilFreshWindow(59_999, WINDOW, 20)).toBe(1);
    expect(msUntilFreshWindow(120_000 + 45_000, WINDOW, 20)).toBe(15_000);
  });

  it('窓の残りがちょうど必要な秒数のときは待たない', () => {
    expect(msUntilFreshWindow(40_000, WINDOW, 20)).toBe(0);
    expect(msUntilFreshWindow(40_001, WINDOW, 20)).toBe(19_999);
  });
});

describe('ownIpLastOctet', () => {
  it('2 つのテストの IP は 繰り返しと分がどう組み合わさっても重ならない', () => {
    const octets = (testNo: number) => {
      const out = new Set<number>();
      for (let repeat = 0; repeat < 20; repeat += 1) {
        for (const minute of [29_000_000, 29_000_001])
          out.add(ownIpLastOctet(testNo, repeat, minute));
      }
      return out;
    };
    const a = octets(0);
    const b = octets(1);
    for (const n of [...a, ...b]) expect(n).toBeGreaterThanOrEqual(1);
    for (const n of [...a, ...b]) expect(n).toBeLessThanOrEqual(250);
    expect([...a].filter((n) => b.has(n))).toEqual([]);
  });

  it('同じテストの 20 回の繰り返しは 同じ分の中で重ならない', () => {
    const set = new Set(Array.from({ length: 20 }, (_, r) => ownIpLastOctet(0, r, 29_000_000)));
    expect(set.size).toBe(20);
  });
});
