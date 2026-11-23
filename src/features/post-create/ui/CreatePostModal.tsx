'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { trapTab } from '../../../shared/ui/focus-trap';
import { CloseIcon } from '../../../shared/ui/icons';
import { CreatePostForm } from './CreatePostForm';

/** Whether closing the modal needs the user's word first: only once a photo is picked. */
export function needsDiscardCheck(photoCount: number): boolean {
  return photoCount > 0;
}

/**
 * The create flow opened over the screen the nav's 投稿 was pressed on (an intercepting route,
 * ADR-0043). Closing is one history step back, so ×, Esc, the backdrop and the browser's back
 * all do the same thing, except that picked photos are only dropped after "破棄". While it is open
 * the page behind does not scroll and the focus stays inside; closing returns the focus to the nav.
 */
export function CreatePostModal({ viewer }: { viewer: { username: string } | null }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const alert = useRef<HTMLDialogElement>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const count = useRef(0);
  count.current = photoCount;
  // While a share runs, closing would let it finish and navigate to the new post afterwards.
  const [busy, setBusy] = useState(false);
  const busyNow = useRef(false);
  const markBusy = useCallback((value: boolean) => {
    busyNow.current = value; // read by the close handlers before the next render
    setBusy(value);
  }, []);

  const leave = useCallback(() => router.back(), [router]);
  const requestClose = useCallback(() => {
    if (busyNow.current) return;
    if (needsDiscardCheck(count.current)) alert.current?.showModal();
    else leave();
  }, [leave]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus({ preventScroll: true });

    const nestedOpen = () => root.current?.querySelector('dialog[open]') != null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || nestedOpen()) return; // the discard check handles its own keys
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      } else if (root.current) {
        trapTab(e, root.current);
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (root.current && e.target instanceof Node && !root.current.contains(e.target)) {
        dialog.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = previous;
      // Back to the nav item that opened it (the visible one: the side nav or the bottom tab).
      const active = document.activeElement;
      if (!active || active === document.body) {
        const opener = Array.from(document.querySelectorAll<HTMLElement>('a[href="/create"]')).find(
          (a) => a.getClientRects().length > 0,
        );
        opener?.focus({ preventScroll: true });
      }
    };
  }, [requestClose]);

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg nav:bg-[rgba(0,0,0,0.65)]"
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="新規投稿を作成"
        tabIndex={-1}
        style={
          {
            '--create-s': 'min(calc(100dvh - 120px), calc(100vw - 436px), 750px)',
          } as React.CSSProperties
        }
        className="relative h-full w-full outline-none nav:h-auto nav:w-auto"
      >
        <button
          type="button"
          onClick={requestClose}
          disabled={busy}
          className="fixed right-3 top-3 hidden h-[var(--tap-min)] w-[var(--tap-min)] items-center justify-center text-white nav:flex"
        >
          <CloseIcon />
          <span className="sr-only">閉じる</span>
        </button>
        <div
          data-testid="create-box"
          className="h-full w-full overflow-hidden bg-bg transition-[opacity,transform] duration-[var(--motion-panel)] ease-[var(--ease-move-in)] starting:scale-[0.98] starting:opacity-0 nav:h-auto nav:w-auto nav:rounded-xl"
        >
          <CreatePostForm
            variant="modal"
            viewer={viewer}
            onPhotoCount={setPhotoCount}
            onBusyChange={markBusy}
            onClose={requestClose}
          />
        </div>
      </div>

      <dialog
        ref={alert}
        role="alertdialog"
        aria-labelledby="discard-title"
        aria-describedby="discard-body"
        className="m-auto w-[min(400px,calc(100vw-32px))] rounded-xl bg-bg p-0 text-text backdrop:bg-black/65"
      >
        <div className="flex flex-col items-center gap-1 px-8 py-6 text-center">
          <h2 id="discard-title" className="text-[length:var(--font-size-lg)] font-semibold">
            投稿を破棄しますか？
          </h2>
          <p id="discard-body" className="text-[length:var(--font-size-sm)] text-text-secondary">
            今の編集は保存されません。
          </p>
        </div>
        <div className="flex flex-col border-t border-border">
          <button
            type="button"
            onClick={() => {
              alert.current?.close();
              leave();
            }}
            className="min-h-[var(--tap-min)] border-b border-border font-semibold text-danger"
          >
            破棄
          </button>
          <button
            type="button"
            onClick={() => alert.current?.close()}
            className="min-h-[var(--tap-min)]"
          >
            キャンセル
          </button>
        </div>
      </dialog>
    </div>
  );
}
