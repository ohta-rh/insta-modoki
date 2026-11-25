/**
 * Registers `/sw.js` (scope `/`). Never throws and never logs: a browser without Service Workers,
 * an insecure context or a failed registration just leaves the app working without the offline
 * notice (ADR-0076).
 */
export function registerServiceWorker(
  nav: Navigator = navigator,
  win: Window = window,
): void {
  if (!('serviceWorker' in nav) || !win.isSecureContext) return;
  try {
    Promise.resolve(nav.serviceWorker.register('/sw.js', { scope: '/' })).catch(() => {});
  } catch {
    // Nothing to do: the app works without a Service Worker.
  }
}
