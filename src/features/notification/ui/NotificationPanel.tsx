'use client';

import { useEffect, useState } from 'react';
import { listNotificationsAction } from '../api/actions';
import type { NotificationPage } from '../model/schema';
import { NotificationList } from './NotificationList';

type Load =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; page: NotificationPage };

/**
 * The content of the navigation's notification panel. It is mounted only while the panel is open,
 * so the first page is read when the panel opens, and the list (which marks everything read once
 * it is shown) appears only after that read succeeded.
 */
export function NotificationPanel() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    listNotificationsAction({})
      .then((result) => {
        if (current)
          setLoad(result.ok ? { status: 'ready', page: result.data } : { status: 'error' });
      })
      .catch(() => {
        if (current) setLoad({ status: 'error' });
      });
    return () => {
      current = false;
    };
  }, [attempt]);

  if (load.status === 'ready') return <NotificationList initial={load.page} now={Date.now()} />;
  if (load.status === 'error') {
    return (
      <div role="alert" className="px-6 py-4 text-[length:var(--font-size-sm)]">
        <p className="text-danger">通知を読み込めませんでした</p>
        <button
          type="button"
          onClick={() => {
            setLoad({ status: 'loading' });
            setAttempt((n) => n + 1);
          }}
          className="mt-2 min-h-[var(--tap-min)] rounded-lg px-4 font-bold hover:bg-surface"
        >
          もう一度読み込む
        </button>
      </div>
    );
  }
  return (
    <p role="status" className="px-6 py-4 text-[length:var(--font-size-sm)] text-text-secondary">
      読み込み中
    </p>
  );
}
