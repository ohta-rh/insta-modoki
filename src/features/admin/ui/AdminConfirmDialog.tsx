'use client';

import { useEffect, useId, useRef, type RefObject } from 'react';
import { trapTab } from '../../../shared/ui/focus-trap';

const BUTTON =
  'min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-lg px-4 text-[length:var(--font-size-sm)] font-bold';

type Props = {
  open: boolean;
  /** What is deleted, as the title names it ("@haru の投稿"). */
  title: string;
  message: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Takes the focus when the button that opened the dialog no longer exists (the row is gone). */
  fallbackFocus: RefObject<HTMLElement | null>;
};

/**
 * The confirmation before a delete: a modal `<dialog>` (role alertdialog) that traps the focus,
 * closes with Esc or "キャンセル" and gives the focus back to the button that opened it.
 */
export function AdminConfirmDialog({
  open,
  title,
  message,
  busy,
  onConfirm,
  onCancel,
  fallbackFocus,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      opener.current = document.activeElement as HTMLElement | null;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
      const back = opener.current?.isConnected ? opener.current : fallbackFocus.current;
      back?.focus();
    }
  }, [open, fallbackFocus]);

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(e) => {
        // Esc: the state closes it (and returns the focus), not the browser.
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onKeyDown={(e) => trapTab(e, e.currentTarget)}
      className="m-auto w-[min(92vw,360px)] rounded-xl bg-bg p-5 text-text shadow-xl backdrop:bg-black/50"
    >
      <h2 id={titleId} className="text-[length:var(--font-size-md)] font-bold">
        {title} を削除しますか？
      </h2>
      <p id={messageId} className="mt-2 text-[length:var(--font-size-sm)] text-text-secondary">
        {message}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            if (!busy) onCancel();
          }}
          aria-disabled={busy || undefined}
          className={`${BUTTON} border border-border hover:bg-surface aria-disabled:opacity-50`}
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={onConfirm}
          aria-disabled={busy || undefined}
          className={`${BUTTON} bg-text text-bg aria-disabled:opacity-50`}
        >
          削除する
        </button>
      </div>
    </dialog>
  );
}
