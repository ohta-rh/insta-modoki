import { describe, expect, it } from 'vitest';
import { encodeCursor } from '../../../shared/db/cursor';
import { parseGetFeedInput } from './schema';

describe('parseGetFeedInput', () => {
  it('入力が無い・cursor が無いとき cursor は null になる', () => {
    expect(parseGetFeedInput(undefined)).toEqual({ cursor: null });
    expect(parseGetFeedInput({})).toEqual({ cursor: null });
    expect(parseGetFeedInput({ cursor: null })).toEqual({ cursor: null });
  });

  it('正しいカーソルを読み取る', () => {
    const cursor = { createdAt: new Date('2026-11-01T00:00:00.000Z'), id: 'abc' };
    expect(parseGetFeedInput({ cursor: encodeCursor(cursor) })).toEqual({ cursor });
  });

  it('壊れたカーソルや文字列でないカーソル、オブジェクトでない入力は VALIDATION を投げる', () => {
    for (const input of [{ cursor: '!!' }, { cursor: 7 }, { cursor: '' }, 'x', 3]) {
      expect(() => parseGetFeedInput(input), JSON.stringify(input)).toThrow(
        expect.objectContaining({ code: 'VALIDATION' }),
      );
    }
  });
});
