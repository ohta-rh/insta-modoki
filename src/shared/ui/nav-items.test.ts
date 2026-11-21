import { describe, expect, it } from 'vitest';
import { isAuthScreen, isCurrent, navItems } from './nav-items';

const haru = { username: 'haru' };

function currentLabels(path: string, viewer: { username: string } | null): string[] {
  return navItems(viewer)
    .filter((item) => isCurrent(item, path, viewer))
    .map((item) => item.label);
}

describe('navItems', () => {
  it('5 項目が ホーム・検索・投稿・通知・プロフィール の順に並ぶ', () => {
    expect(navItems(haru).map((i) => i.label)).toEqual([
      'ホーム',
      '検索',
      '投稿',
      '通知',
      'プロフィール',
    ]);
  });

  it('viewer が haru のとき プロフィール は /haru', () => {
    const items = navItems(haru);
    expect(items.find((i) => i.label === 'プロフィール')?.href).toBe('/haru');
    expect(items.map((i) => i.href)).toEqual([
      '/',
      '/explore/search',
      '/create',
      '/notifications',
      '/haru',
    ]);
  });

  it('viewer が null のとき 投稿 と 通知 と プロフィール は /accounts/login', () => {
    const items = navItems(null);
    for (const label of ['投稿', '通知', 'プロフィール']) {
      expect(items.find((i) => i.label === label)?.href, label).toBe('/accounts/login');
    }
    expect(items.find((i) => i.label === 'ホーム')?.href).toBe('/');
    expect(items.find((i) => i.label === '検索')?.href).toBe('/explore/search');
  });
});

describe('isCurrent', () => {
  it('/ では ホーム だけが現在になる', () => {
    expect(currentLabels('/', haru)).toEqual(['ホーム']);
  });

  it('/explore/search では 検索 が現在になる', () => {
    expect(currentLabels('/explore/search', haru)).toEqual(['検索']);
  });

  it('/p/abc ではどれも現在にならない', () => {
    expect(currentLabels('/p/abc', haru)).toEqual([]);
  });

  it('/haru/followers で viewer が haru のとき プロフィール が現在になる', () => {
    expect(currentLabels('/haru/followers', haru)).toEqual(['プロフィール']);
  });

  it('他人のプロフィールでは プロフィール は現在にならない', () => {
    expect(currentLabels('/mio', haru)).toEqual([]);
    expect(currentLabels('/haruka', haru)).toEqual([]);
  });

  it('viewer が null のとき ログインの画面では 投稿・通知・プロフィール は現在にならない', () => {
    expect(currentLabels('/accounts/login', null)).toEqual([]);
  });
});

describe('navItems のプロフィールの href', () => {
  it('username に URL で意味を持つ文字があっても encodeURIComponent した 1 つのパスになる', () => {
    const href = navItems({ username: '../x?y#z' }).find((i) => i.key === 'profile')!.href;
    expect(href).toBe('/..%2Fx%3Fy%23z');
    expect(href.split('/')).toHaveLength(2);
  });
});

describe('isAuthScreen', () => {
  it('サインアップとログインの画面だけが true', () => {
    expect(isAuthScreen('/accounts/signup')).toBe(true);
    expect(isAuthScreen('/accounts/login')).toBe(true);
    expect(isAuthScreen('/accounts/edit')).toBe(false);
    expect(isAuthScreen('/')).toBe(false);
  });
});
