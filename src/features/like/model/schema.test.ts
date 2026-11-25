import { describe, expect, it } from 'vitest';
import { likeInput, listLikersInput } from './schema';

describe('likeInput', () => {
  it('postId だけのとき通る', () => {
    expect(likeInput.safeParse({ postId: 'abc' }).success).toBe(true);
  });

  it('未知のキーを拒む', () => {
    const r = likeInput.safeParse({ postId: 'abc', userId: 'someone-else' });
    expect(r.success).toBe(false);
  });

  it('オブジェクトでないとき拒み、postId の中身はここでは調べない', () => {
    expect(likeInput.safeParse(null).success).toBe(false);
    expect(likeInput.safeParse('abc').success).toBe(false);
    expect(likeInput.safeParse({ postId: 7 }).success).toBe(true);
  });
});

describe('listLikersInput', () => {
  it('cursor が省けて、文字列なら通る', () => {
    expect(listLikersInput.safeParse({ postId: 'a' }).success).toBe(true);
    expect(listLikersInput.safeParse({ postId: 'a', cursor: 'c' }).success).toBe(true);
  });

  it('未知のキーを拒む', () => {
    expect(listLikersInput.safeParse({ postId: 'a', limit: 100 }).success).toBe(false);
  });
});
