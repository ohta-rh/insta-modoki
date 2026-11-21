import { describe, expect, it } from 'vitest';
import { isProtectedPath } from './protected-paths';

describe('isProtectedPath', () => {
  it('/ と /create と /accounts/edit は保護され /p/abc と /haru は保護されない', () => {
    expect(isProtectedPath('/')).toBe(true);
    expect(isProtectedPath('/create')).toBe(true);
    expect(isProtectedPath('/accounts/edit')).toBe(true);
    expect(isProtectedPath('/p/abc')).toBe(false);
    expect(isProtectedPath('/haru')).toBe(false);
  });

  it('M3 と M4 の画面とその下は保護される', () => {
    for (const p of ['/explore', '/explore/search', '/notifications', '/stories/create']) {
      expect(isProtectedPath(p), p).toBe(true);
    }
    for (const p of ['/direct', '/direct/abc', '/reels']) expect(isProtectedPath(p), p).toBe(true);
  });

  it('サインアップとログインと似た名前は保護されない', () => {
    for (const p of [
      '/accounts/signup',
      '/accounts/login',
      '/createx',
      '/exploreme',
      '/haru/followers',
    ]) {
      expect(isProtectedPath(p), p).toBe(false);
    }
  });

  it('末尾のスラッシュがあっても同じ結果になる', () => {
    expect(isProtectedPath('/create/')).toBe(true);
    expect(isProtectedPath('/haru/')).toBe(false);
  });
});
