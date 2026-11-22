'use client';

import { useEffect, useRef, useState } from 'react';
import { listNotificationsAction, markNotificationsReadAction } from '../api/actions';
import { initList, loadMore, type ListState } from '../model/load-more';
import type { NotificationPage } from '../model/schema';
import { NotificationItem } from './NotificationItem';
import { unreadStore } from './unread-store';

/** The rows, the empty message, and the "さらに表示" button with its alert. No state: tests render it. */
export function NotificationListView({
  state,
  now,
  loading = false,
  onMore = () => {},
}: {
  state: ListState;
  now: number;
  loading?: boolean;
  onMore?: () => void;
}) {
  if (state.items.length === 0) {
    return (
      <p className="py-10 text-center text-[length:var(--font-size-sm)] text-text-secondary">
        まだ通知はありません
      </p>
    );
  }
  return (
    <>
      <ul aria-label="通知の一覧">
        {state.items.map((view) => (
          <NotificationItem key={view.id} view={view} now={now} />
        ))}
      </ul>
      {state.error ? (
        <p
          role="alert"
          className="px-4 py-2 text-center text-[length:var(--font-size-sm)] text-red-700"
        >
          {state.error}
        </p>
      ) : null}
      {state.nextCursor !== null ? (
        <div className="px-4 py-3 text-center">
          <button
            type="button"
            onClick={onMore}
            disabled={loading}
            className="min-h-[var(--tap-min)] rounded-lg px-4 text-[length:var(--font-size-sm)] font-bold hover:bg-surface disabled:opacity-60"
          >
            さらに表示
          </button>
        </div>
      ) : null}
    </>
  );
}

/**
 * The notification list. After the first paint it marks everything read once; the rows keep the
 * "新着" they came with, and the badge goes to 0. A failed marking is ignored (the next poll of
 * the count corrects the badge).
 */
export function NotificationList({ initial, now }: { initial: NotificationPage; now: number }) {
  const [state, setState] = useState<ListState>(() => initList(initial));
  const [loading, setLoading] = useState(false);
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    markNotificationsReadAction()
      .then((result) => {
        if (result.ok) unreadStore.set(0);
      })
      .catch(() => {});
  }, []);

  const more = async () => {
    setLoading(true);
    setState(await loadMore(state, (cursor) => listNotificationsAction({ cursor })));
    setLoading(false);
  };

  return (
    <NotificationListView state={state} now={now} loading={loading} onMore={() => void more()} />
  );
}
