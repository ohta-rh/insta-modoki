'use client';

import { INTERNAL_MESSAGE } from '../../../shared/errors';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserSummary } from '../../post';
import { listFollowersAction, listFollowingAction } from '../api/actions';

type Status = 'idle' | 'loading' | 'error';

const EMPTY = {
  followers: 'まだフォロワーはいません',
  following: 'まだ誰もフォローしていません',
} as const;

/**
 * The people of a follower / following list. The first page comes from the server and works without
 * JavaScript; when more exist, a marker below the last row loads the next 20 as it scrolls into
 * view. A failed load says so and offers a retry. Each row links to the person's profile.
 */
export function FollowList({
  username,
  kind,
  initialItems,
  initialCursor,
}: {
  username: string;
  kind: 'followers' | 'following';
  initialItems: UserSummary[];
  initialCursor: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [next, setNext] = useState(initialCursor);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const sentinel = useRef<HTMLLIElement>(null);
  const action = kind === 'followers' ? listFollowersAction : listFollowingAction;

  const load = useCallback(
    async (cursor: string) => {
      setStatus('loading');
      setMessage(null);
      try {
        const result = await action({ username, cursor });
        if (!result.ok) {
          setMessage(result.error.message);
          setStatus('error');
          return;
        }
        setItems((prev) => [...prev, ...result.page.items]);
        setNext(result.page.nextCursor);
        setStatus('idle');
      } catch {
        setMessage(INTERNAL_MESSAGE);
        setStatus('error');
      }
    },
    [action, username],
  );

  // The next page loads when the end of the list is in view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || next === null || status !== 'idle') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        void load(next);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [next, status, load, items.length]);

  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-[length:var(--font-size-sm)] text-text-secondary">
        {EMPTY[kind]}
      </p>
    );
  }
  return (
    <>
      <ul data-testid="follow-list" aria-label={kind === 'followers' ? 'フォロワー' : 'フォロー中'}>
        {items.map((u) => (
          <li key={u.username}>
            <a
              href={`/${u.username}`}
              className="flex min-h-[var(--tap-min)] items-center gap-3 px-4 py-2"
            >
              {u.avatarUrl ? (
                <img
                  src={u.avatarUrl}
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-full bg-surface object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-surface font-bold text-text-secondary"
                >
                  {Array.from(u.username)[0]?.toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-[length:var(--font-size-sm)] font-bold">
                  {u.username}
                </span>
                <span className="block truncate text-[length:var(--font-size-sm)] text-text-secondary">
                  {u.displayName}
                </span>
              </span>
            </a>
          </li>
        ))}
        {next !== null && <li ref={sentinel} aria-hidden="true" className="h-1" />}
      </ul>
      {status === 'loading' && (
        <p role="status" className="py-2 text-center text-[length:var(--font-size-sm)]">
          読み込み中…
        </p>
      )}
      {status === 'error' && (
        <div className="py-2 text-center">
          <p role="alert" className="text-[length:var(--font-size-sm)] text-red-700">
            {message}
          </p>
          <button
            type="button"
            onClick={() => next !== null && void load(next)}
            className="mt-1 min-h-[var(--tap-min)] rounded-lg px-3 text-[length:var(--font-size-sm)] font-bold hover:bg-surface"
          >
            もう一度読み込む
          </button>
        </div>
      )}
    </>
  );
}
