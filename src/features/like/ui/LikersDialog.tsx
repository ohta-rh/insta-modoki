'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { listLikersAction } from '../api/actions';
import { useLikeScope } from './LikeScope';

type Liker = { username: string; displayName: string; avatarUrl: string | null };
type Status = 'idle' | 'loading' | 'error';

/**
 * "N 件のいいね" and the dialog it opens: the people who liked, 20 at a time, the next page loaded
 * when the end of the list scrolls into view. The button opens the dialog by itself (commandfor), so
 * it works before hydration; the list is fetched once the page is hydrated. Escape closes it and the
 * focus goes back to the button.
 */
export function LikersDialog() {
  const { postId, snapshot } = useLikeScope();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLLIElement>(null);
  const generation = useRef(0);
  const titleId = useId();
  const [items, setItems] = useState<Liker[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(
    async (cursor: string | null, gen: number) => {
      setStatus('loading');
      setMessage(null);
      try {
        const result = await listLikersAction(cursor ? { postId, cursor } : { postId });
        if (gen !== generation.current) return;
        if (!result.ok) {
          setMessage(result.error.message);
          setStatus('error');
          return;
        }
        setItems((prev) => (cursor ? [...prev, ...result.page.items] : result.page.items));
        setNext(result.page.nextCursor);
        setLoadedOnce(true);
        setStatus('idle');
      } catch {
        if (gen !== generation.current) return;
        setMessage('エラーが発生しました。しばらくしてからもう一度お試しください');
        setStatus('error');
      }
    },
    [postId],
  );

  const restart = useCallback(() => {
    generation.current += 1;
    setItems([]);
    setNext(null);
    setLoadedOnce(false);
    void load(null, generation.current);
  }, [load]);

  // A dialog opened before hydration (commandfor) has not fetched anything yet.
  useEffect(() => {
    if (dialog.current?.open) restart();
  }, [restart]);

  // The next page loads when the end of the list is in view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || next === null || status !== 'idle') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          void load(next, generation.current);
        }
      },
      { root: scroller.current },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [next, status, load, items.length]);

  const dialogId = `likers-dialog-${postId}`;
  const trapFocus = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)'),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        {...({ commandfor: dialogId, command: 'show-modal' } as object)}
        onClick={() => {
          if (dialog.current && !dialog.current.open) dialog.current.showModal();
          restart();
        }}
        className="min-h-[var(--tap-min)] rounded-lg px-2 text-[length:var(--font-size-sm)] font-bold hover:bg-surface"
      >
        {`${snapshot.count} 件のいいね`}
      </button>
      <dialog
        ref={dialog}
        id={dialogId}
        aria-labelledby={titleId}
        onClose={() => trigger.current?.focus()}
        onKeyDown={trapFocus}
        className="m-auto w-[min(92vw,400px)] rounded-xl bg-bg p-0 text-text shadow-xl backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 id={titleId} className="text-[length:var(--font-size-md)] font-bold">
            いいねした人
          </h2>
          <form method="dialog">
            <button
              type="submit"
              className="min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-lg px-2 text-[length:var(--font-size-sm)] font-bold hover:bg-surface"
            >
              閉じる
            </button>
          </form>
        </div>
        <div ref={scroller} className="max-h-[60vh] overflow-y-auto px-4 py-2">
          {loadedOnce && items.length === 0 ? (
            <p className="py-6 text-center text-[length:var(--font-size-sm)] text-text-secondary">
              まだいいねはありません
            </p>
          ) : (
            <ul aria-label="いいねした人">
              {items.map((u) => (
                <li key={u.username}>
                  <a
                    href={`/${u.username}`}
                    className="flex min-h-[var(--tap-min)] items-center gap-3 py-1"
                  >
                    {u.avatarUrl ? (
                      <img
                        src={u.avatarUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full bg-surface object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-surface font-bold text-text-secondary"
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
          )}
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
                onClick={() => void load(next, generation.current)}
                className="mt-1 min-h-[var(--tap-min)] rounded-lg px-3 text-[length:var(--font-size-sm)] font-bold hover:bg-surface"
              >
                もう一度読み込む
              </button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
