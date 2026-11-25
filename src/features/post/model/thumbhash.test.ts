import { describe, expect, it } from 'vitest';
import { thumbhashAverageColor, thumbhashDataUrl } from './thumbhash';

describe('thumbhashDataUrl', () => {
  it('ThumbHash の base64 から PNG の data URL を作る', () => {
    expect(thumbhashDataUrl('YJqGPQw7sFlslqhFafSE+Q6oJ1h2iHB2Rw==')).toMatch(
      /^data:image\/png;base64,/,
    );
  });

  it('壊れた値のとき null を返す', () => {
    expect(thumbhashDataUrl('')).toBeNull();
    expect(thumbhashDataUrl('!!!')).toBeNull();
    expect(thumbhashDataUrl('AAAA')).toBeNull();
  });
});

describe('thumbhashAverageColor', () => {
  it('ThumbHash の平均の色を rgb(r g b)（0〜255 の整数）で返す', () => {
    const m = /^rgb\((\d+) (\d+) (\d+)\)$/.exec(
      thumbhashAverageColor('YJqGPQw7sFlslqhFafSE+Q6oJ1h2iHB2Rw==') ?? '',
    );
    expect(m).not.toBeNull();
    for (const v of m!.slice(1)) expect(Number(v)).toBeLessThanOrEqual(255);
  });

  it('壊れた値（5 バイト未満・25 バイト超・base64 でない）のとき null を返す', () => {
    expect(thumbhashAverageColor('')).toBeNull();
    expect(thumbhashAverageColor('!!!')).toBeNull();
    expect(thumbhashAverageColor('AAAA')).toBeNull();
    expect(thumbhashAverageColor(btoa('x'.repeat(26)))).toBeNull();
  });
});
