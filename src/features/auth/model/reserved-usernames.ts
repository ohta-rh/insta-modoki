// Mirrors docs/architecture/routes.md "予約したユーザー名" (a test keeps them in step).
export const RESERVED_USERNAMES: readonly string[] = [
  'accounts',
  'p',
  'create',
  'explore',
  'notifications',
  'stories',
  'direct',
  'reels',
  'admin',
  'about',
  'api',
  'static',
  'assets',
  '_next',
  'favicon.ico',
  'robots.txt',
  'manifest.webmanifest',
  'sw.js',
];

export const isReservedUsername = (username: string): boolean =>
  RESERVED_USERNAMES.includes(username);
