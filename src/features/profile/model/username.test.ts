import { describe, expect, it } from 'vitest';
import { lookupUsername } from './username';

describe('lookupUsername', () => {
  it('大文字を小文字にして返す', () => {
    expect(lookupUsername('HARU')).toBe('haru');
    expect(lookupUsername('Haru.Y_1')).toBe('haru.y_1');
  });

  it.each(['.abc', 'abc.', 'a..b', 'ab', 'accounts', 'a b', '', 'ab\u0000c', 'ＨＡＲＵ'])(
    '形式が不正または予約語の %j のとき null を返す',
    (value) => {
      expect(lookupUsername(value)).toBeNull();
    },
  );

  it('文字列でないとき null を返す', () => {
    expect(lookupUsername(7)).toBeNull();
    expect(lookupUsername(undefined)).toBeNull();
    expect(lookupUsername(null)).toBeNull();
  });
});
