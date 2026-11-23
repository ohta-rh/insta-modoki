export type Viewer = { username: string } | null;

export type NavIcon = 'home' | 'search' | 'compass' | 'plus-square' | 'bell' | 'user';

export type NavItem = {
  key: 'home' | 'search' | 'explore' | 'create' | 'notifications' | 'profile';
  label: string;
  href: string;
  icon: NavIcon;
  /** `side`: shown in the side navigation only (the bottom tabs have no room for it). */
  placement: 'all' | 'side';
  /** True when href is the login page standing in for a screen that needs a session. */
  requiresLogin: boolean;
};

export const LOGIN_PATH = '/accounts/login';

export function navItems(viewer: Viewer): NavItem[] {
  const gated = (path: string) => (viewer ? path : LOGIN_PATH);
  return [
    { key: 'home', label: 'ホーム', href: '/', icon: 'home', requiresLogin: false, placement: 'all' },
    {
      key: 'search',
      label: '検索',
      href: '/explore/search',
      icon: 'search',
      requiresLogin: false,
      placement: 'side',
    },
    {
      key: 'explore',
      label: '発見',
      href: '/explore',
      icon: 'compass',
      requiresLogin: false,
      placement: 'all',
    },
    {
      key: 'create',
      label: '投稿',
      href: gated('/create'),
      icon: 'plus-square',
      requiresLogin: true,
      placement: 'all',
    },
    {
      key: 'notifications',
      label: '通知',
      href: gated('/notifications'),
      icon: 'bell',
      requiresLogin: true,
      placement: 'all',
    },
    {
      key: 'profile',
      label: 'プロフィール',
      href: viewer ? `/${encodeURIComponent(viewer.username)}` : LOGIN_PATH,
      icon: 'user',
      requiresLogin: true,
      placement: 'all',
    },
  ];
}

export const MORE_LINKS = [
  { label: 'プロフィールを編集', href: '/accounts/edit' },
  { label: 'ログアウト', href: '/accounts/logout' },
] as const;

const under = (item: { href: string }, path: string) =>
  path === item.href || path.startsWith(`${item.href}/`);

/**
 * `/` matches only `/`; the others match their href or anything below it, unless another item
 * with a longer href matches too (`/explore/search` is 検索, not 発見).
 */
export function isCurrent(item: NavItem, path: string, viewer: Viewer): boolean {
  if (item.requiresLogin && !viewer) return false;
  if (item.href === '/') return path === '/';
  if (!under(item, path)) return false;
  return !navItems(viewer).some(
    (other) =>
      other.key !== item.key &&
      other.href.length > item.href.length &&
      other.href.startsWith(`${item.href}/`) &&
      under(other, path),
  );
}

/** Sign-up and log-in render without the navigation. */
export const isAuthScreen = (path: string): boolean =>
  path === '/accounts/signup' || path === '/accounts/login';
