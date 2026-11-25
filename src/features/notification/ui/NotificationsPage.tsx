import { headers } from 'next/headers';
import { connection } from 'next/server';
import { listNotifications } from '../api/list-notifications';
import { NotificationList } from './NotificationList';

/** The `/notifications` screen: the first page is rendered on the server, the rest loads on demand. */
export async function NotificationsPage() {
  await connection();
  const page = await listNotifications({}, { headers: await headers() });
  return (
    <section aria-labelledby="notifications-title">
      <h1
        id="notifications-title"
        className="px-4 py-4 text-[length:var(--font-size-lg)] font-bold"
      >
        通知
      </h1>
      <NotificationList initial={page} now={Date.now()} />
    </section>
  );
}
