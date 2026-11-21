import { describe, expect, it } from 'vitest';
import { median, p95 } from './stats.mjs';

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('p95', () => {
  it('1 から 100 の p95 は 95', () => {
    expect(p95(range(100))).toBe(95);
  });
  it('1 から 20 の p95 は 19', () => {
    expect(p95(range(20))).toBe(19);
  });
  it('順番に依らない', () => {
    expect(p95(range(20).reverse())).toBe(19);
  });
  it('空の一覧は投げる', () => {
    expect(() => p95([])).toThrow();
  });
});

describe('median', () => {
  it('奇数個は真ん中、偶数個は真ん中 2 つの平均', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it('空の一覧は投げる', () => {
    expect(() => median([])).toThrow();
  });
});
