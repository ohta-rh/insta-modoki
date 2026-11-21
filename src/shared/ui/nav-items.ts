export type Viewer = { username: string } | null;

export type NavIcon = 'home' | 'search' | 'plus-square' | 'bell' | 'user';

export type NavItem = {
  key: 'home' | 'search' | 'create' | 'notifications' | 'profile';
  label: string;
  href: string;
  icon: NavIcon;
  /** True when href is the login page standing in for a screen that needs a session. */
  requiresLogin: boolean;
};

export const LOGIN_PATH = '/accounts/login';

export function navItems(viewer: Viewer): NavItem[] {
  const gated = (path: string) => (viewer ? path : LOGIN_PATH);
  return [
    { key: 'home', label: 'ホーム', href: '/', icon: 'home', requiresLogin: false },
    { key: 'search', label: '検索', href: '/explore/search', icon: 'search', requiresLogin: false },
    {
      key: 'create',
      label: '投稿',
      href: gated('/create'),
      icon: 'plus-square',
      requiresLogin: true,
    },
    {
      key: 'notifications',
      label: '通知',
      href: gated('/notifications'),
      icon: 'bell',
      requiresLogin: true,
    },
    {
      key: 'profile',
      label: 'プロフィール',
      href: viewer ? `/${encodeURIComponent(viewer.username)}` : LOGIN_PATH,
      icon: 'user',
      requiresLogin: true,
    },
  ];
}

/** `/` matches only `/`; the others match their href or anything below it. */
export function isCurrent(item: NavItem, path: string, viewer: Viewer): boolean {
  if (item.requiresLogin && !viewer) return false;
  if (item.href === '/') return path === '/';
  return path === item.href || path.startsWith(`${item.href}/`);
}

/** Sign-up and log-in render without the navigation. */
export const isAuthScreen = (path: string): boolean =>
  path === '/accounts/signup' || path === '/accounts/login';
