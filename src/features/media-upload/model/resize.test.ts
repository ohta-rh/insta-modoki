import { describe, expect, it } from 'vitest';
import { fitWithin, variantSize, variantWidth } from './resize';

describe('fitWithin / variantWidth', () => {
  it('長辺 2048 に縮小し 小さい写真は拡大しない', () => {
    expect(fitWithin(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3000, 4000, 2048)).toEqual({ width: 1536, height: 2048 });
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(2048, 2048, 2048)).toEqual({ width: 2048, height: 2048 });
  });

  it('縮小しても 1 画素より小さくならない', () => {
    expect(fitWithin(20000, 3, 2048)).toEqual({ width: 2048, height: 1 });
  });

  it('配信用の幅は 1080 640 320 を上限にする', () => {
    expect(variantWidth(2048, 1080)).toBe(1080);
    expect(variantWidth(2048, 640)).toBe(640);
    expect(variantWidth(2048, 320)).toBe(320);
    expect(variantWidth(800, 1080)).toBe(800);
    expect(variantWidth(800, 640)).toBe(640);
    expect(variantWidth(300, 320)).toBe(300);
  });

  it('配信用の大きさは縦横比を保つ', () => {
    expect(variantSize({ width: 2048, height: 1536 }, 1080)).toEqual({ width: 1080, height: 810 });
    expect(variantSize({ width: 800, height: 600 }, 1080)).toEqual({ width: 800, height: 600 });
    expect(variantSize({ width: 1536, height: 2048 }, 320)).toEqual({ width: 320, height: 427 });
  });
});
