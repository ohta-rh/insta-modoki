import { describe, expect, it } from 'vitest';
import { parseSearchQuery } from './schema';

const fail = (input: unknown) => {
  const r = parseSearchQuery(input);
  if (r.ok) throw new Error('expected a failure');
  return r.fieldErrors.q;
};

describe('parseSearchQuery', () => {
  it('q が 30 字のとき通り、31 字と空白だけと制御文字のとき失敗する', () => {
    expect(parseSearchQuery('a'.repeat(30))).toEqual({ ok: true, q: 'a'.repeat(30) });
    // 30 code points that are 60 UTF-16 units pass: the count is in code points.
    expect(parseSearchQuery('😀'.repeat(30))).toEqual({ ok: true, q: '😀'.repeat(30) });
    expect(parseSearchQuery('  ha　')).toEqual({ ok: true, q: 'ha' });
    expect(fail('a'.repeat(31))).toEqual(['検索する文字は 30 文字以内で入力してください']);
    expect(fail('')).toEqual(['検索する文字を入力してください']);
    expect(fail(' 　 ')).toEqual(['検索する文字を入力してください']);
    expect(fail('a\u0000b')).toEqual(['使えない文字が含まれています']);
    expect(fail('a\nb')).toEqual(['使えない文字が含まれています']);
    expect(fail(123)).toEqual(['検索する文字を入力してください']);
    expect(fail(undefined)).toEqual(['検索する文字を入力してください']);
    expect(fail(null)).toEqual(['検索する文字を入力してください']);
  });
});
