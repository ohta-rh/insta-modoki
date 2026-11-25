import { describe, expect, it } from 'vitest';
import { followInput, listFollowInput } from './schema';

describe('followInput', () => {
  it('username だけのとき通る', () => {
    expect(followInput.safeParse({ username: 'bob' }).success).toBe(true);
  });

  it('未知のキーを拒む', () => {
    const r = followInput.safeParse({ username: 'bob', followerId: 'someone-else' });
    expect(r.success).toBe(false);
  });

  it('オブジェクトでないとき拒み、username の中身はここでは調べない', () => {
    expect(followInput.safeParse(null).success).toBe(false);
    expect(followInput.safeParse('bob').success).toBe(false);
    expect(followInput.safeParse({ username: 7 }).success).toBe(true);
  });
});

describe('listFollowInput', () => {
  it('cursor が省けて、文字列なら通る', () => {
    expect(listFollowInput.safeParse({ username: 'a' }).success).toBe(true);
    expect(listFollowInput.safeParse({ username: 'a', cursor: 'c' }).success).toBe(true);
  });

  it('未知のキーを拒む', () => {
    expect(listFollowInput.safeParse({ username: 'a', limit: 100 }).success).toBe(false);
  });
});
