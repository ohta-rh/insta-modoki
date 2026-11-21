import { describe, expect, it } from 'vitest';
import { thumbhashDataUrl } from './thumbhash';

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
