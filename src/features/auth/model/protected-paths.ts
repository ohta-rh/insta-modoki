// Screens marked "ログイン: 要" in docs/architecture/routes.md. The (app) route group's layout
// enforces them; this list is the single place that names them.
const EXACT = ['/', '/accounts/edit', '/create'];
const TREES = ['/explore', '/notifications', '/stories', '/direct', '/reels'];

export function isProtectedPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return EXACT.includes(path) || TREES.some((root) => path === root || path.startsWith(`${root}/`));
}
