import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, validateFile } from './validate-file';

const TOO_BIG = 'ファイルが大きすぎます（1 枚 10MB まで）';
const BAD_TYPE = 'この形式は使えません（JPEG・PNG・WebP・HEIC）';

describe('validateFile', () => {
  it('10MB ちょうどを受け付け 1 バイト超を拒む', () => {
    expect(MAX_FILE_BYTES).toBe(10_485_760);
    expect(validateFile({ name: 'a.jpg', type: 'image/jpeg', size: 10_485_760 })).toEqual({
      ok: true,
    });
    expect(validateFile({ name: 'a.jpg', type: 'image/jpeg', size: 10_485_761 })).toEqual({
      ok: false,
      message: TOO_BIG,
    });
  });

  it('許可外の形式を拒む', () => {
    expect(validateFile({ name: 'a.gif', type: 'image/gif', size: 100 })).toEqual({
      ok: false,
      message: BAD_TYPE,
    });
    expect(validateFile({ name: 'a.jpg', type: 'text/plain', size: 100 })).toEqual({
      ok: false,
      message: BAD_TYPE,
    });
    expect(validateFile({ name: 'a.gif', type: '', size: 100 })).toEqual({
      ok: false,
      message: BAD_TYPE,
    });
  });

  it('許可する形式と 種類が空のときの拡張子を受け付ける', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']) {
      expect(validateFile({ name: 'x', type, size: 1 }), type).toEqual({ ok: true });
    }
    for (const name of ['a.jpg', 'a.JPEG', 'a.png', 'a.webp', 'a.HEIC', 'a.heif']) {
      expect(validateFile({ name, type: '', size: 1 }), name).toEqual({ ok: true });
    }
  });
});
