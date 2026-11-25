import { describe, expect, it } from 'vitest';
import { isAuthScreen, isCurrent, MORE_LINKS, navItems } from './nav-items';

const haru = { username: 'haru' };

function currentLabels(path: string, viewer: { username: string } | null): string[] {
  return navItems(viewer)
    .filter((item) => isCurrent(item, path, viewer))
    .map((item) => item.label);
}

describe('navItems', () => {
  it('6 項目が ホーム・検索・発見・投稿・通知・プロフィール の順に並ぶ', () => {
    expect(navItems(haru).map((i) => i.label)).toEqual([
      'ホーム',
      '検索',
      '発見',
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
      '/explore',
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
    expect(items.find((i) => i.label === '発見')?.href).toBe('/explore');
  });

  it('検索だけが side、他は all（下部タブは 5 項目）', () => {
    const items = navItems(haru);
    expect(items.filter((i) => i.placement === 'side').map((i) => i.label)).toEqual(['検索']);
    expect(items.filter((i) => i.placement === 'all')).toHaveLength(5);
  });
});

describe('MORE_LINKS', () => {
  it('プロフィールを編集とログアウトのリンク', () => {
    expect(MORE_LINKS).toEqual([
      { label: 'プロフィールを編集', href: '/accounts/edit' },
      { label: 'ログアウト', href: '/accounts/logout' },
    ]);
  });
});

describe('isCurrent', () => {
  it('/ では ホーム だけが現在になる', () => {
    expect(currentLabels('/', haru)).toEqual(['ホーム']);
  });

  it('検索は /explore/search、発見はそれ以外の /explore の下で今の項目になる', () => {
    expect(currentLabels('/explore/search', haru)).toEqual(['検索']);
    expect(currentLabels('/explore', haru)).toEqual(['発見']);
    expect(currentLabels('/explore/tags/a', haru)).toEqual(['発見']);
    expect(currentLabels('/exploreX', haru)).toEqual([]);
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
