// The notification slice's entry for the routes and the root layout (ADR-0053): the screens and the
// stream route. `streamNotifications` is here, not in ../index.ts, because it reads the session and
// `next/headers` and the like, comment and follow APIs that import ../index.ts reach the browser.
export { NotificationBadge } from './NotificationBadge';
export { NotificationNavLink } from './NotificationNavLink';
export { NotificationsPage } from './NotificationsPage';
export { streamNotifications } from '../api/stream-notifications';
