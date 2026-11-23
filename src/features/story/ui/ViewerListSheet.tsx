'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { INTERNAL_MESSAGE } from '../../../shared/errors';
import { trapTab } from '../../../shared/ui/focus-trap';
import { listStoryViewersAction } from '../api/actions';

type Viewer = { username: string; displayName: string; avatarUrl: string | null };
type Status = 'idle' | 'loading' | 'error';

/**
 * "閲覧者 N 人" and the dialog it opens: who viewed the story, newest first, 20 at a time with a
 * "さらに表示" button. Only the author's viewer shows it. While it is open the viewer's clock is
 * stopped (`onOpenChange`). The names are plain text, not links: a link would leave the viewer.
 */
export function ViewerListSheet({
  storyId,
  count,
  onOpenChange,
}: {
  storyId: string;
  count: number;
  onOpenChange: (open: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const titleId = useId();
  const [items, setItems] = useState<Viewer[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(
    async (cursor: string | null, gen: number) => {
      setStatus('loading');
      setMessage(null);
      try {
        const result = await listStoryViewersAction(cursor ? { storyId, cursor } : { storyId });
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
        setMessage(INTERNAL_MESSAGE);
        setStatus('error');
      }
    },
    [storyId],
  );

  const open = () => {
    generation.current += 1;
    setItems([]);
    setNext(null);
    setLoadedOnce(false);
    dialog.current?.showModal();
    onOpenChange(true);
    void load(null, generation.current);
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={open}
        className="min-h-[var(--tap-min)] rounded-lg bg-black/60 px-3 text-[length:var(--font-size-sm)] font-bold text-white"
      >
        {`閲覧者 ${count} 人`}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => {
          onOpenChange(false);
          trigger.current?.focus();
        }}
        onKeyDown={(e) => trapTab(e, e.currentTarget)}
        className="m-auto w-[min(92vw,400px)] rounded-xl bg-bg p-0 text-text shadow-xl backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 id={titleId} className="text-[length:var(--font-size-md)] font-bold">
            閲覧者
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
        <div className="max-h-[60vh] overflow-y-auto px-4 py-2">
          {loadedOnce && items.length === 0 ? (
            <p className="py-6 text-center text-[length:var(--font-size-sm)] text-text-secondary">
              まだ誰も見ていません
            </p>
          ) : (
            <ul aria-label="閲覧者">
              {items.map((u) => (
                <li
                  key={u.username}
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
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-surface font-bold text-text"
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
                </li>
              ))}
            </ul>
          )}
          {status === 'loading' && (
            <p role="status" className="py-2 text-center text-[length:var(--font-size-sm)]">
              読み込み中…
            </p>
          )}
          {status === 'error' && (
            <p
              role="alert"
              className="py-2 text-center text-[length:var(--font-size-sm)] text-danger"
            >
              {message}
            </p>
          )}
          {status !== 'loading' && (next !== null || status === 'error') && (
            <div className="py-2 text-center">
              <button
                type="button"
                onClick={() => void load(next, generation.current)}
                className="min-h-[var(--tap-min)] rounded-lg px-3 text-[length:var(--font-size-sm)] font-bold hover:bg-surface"
              >
                {status === 'error' ? 'もう一度読み込む' : 'さらに表示'}
              </button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
