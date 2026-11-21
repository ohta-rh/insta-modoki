'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { deletePostAction } from '../api/actions';

const secondary =
  'min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-lg px-4 text-[length:var(--font-size-sm)] font-bold';

/**
 * "削除" with a confirmation dialog (role alertdialog). The dialog traps the focus, Escape and
 * "キャンセル" close it and return the focus to the button, and "削除" goes to the author's page.
 */
export function DeletePostButton({ postId, username }: { postId: string; username: string }) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const messageId = useId();

  const open = () => {
    setError(null);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await deletePostAction({ postId });
      if (result.ok) {
        router.push(`/${username}`);
        return; // stays disabled until the navigation replaces the screen
      }
      setError(result.error.message);
    } catch {
      setError('エラーが発生しました。しばらくしてからもう一度お試しください');
    }
    setPending(false);
  };

  // Tab and Shift+Tab wrap inside the dialog.
  const trapFocus = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Tab') return;
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)'),
    );
    const first = items[0];
    const last = items[items.length - 1];
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
        onClick={open}
        className={`${secondary} text-text-secondary hover:bg-surface`}
      >
        削除
      </button>
      <dialog
        ref={dialog}
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        // Escape is ignored while the request is running.
        onCancel={(e) => pending && e.preventDefault()}
        onClose={() => trigger.current?.focus()}
        onKeyDown={trapFocus}
        className="m-auto w-[min(92vw,360px)] rounded-xl bg-bg p-5 text-text shadow-xl backdrop:bg-black/50"
      >
        <h2 id={titleId} className="text-[length:var(--font-size-md)] font-bold">
          この投稿を削除しますか？
        </h2>
        <p id={messageId} className="mt-2 text-[length:var(--font-size-sm)] text-text-secondary">
          削除した投稿は元に戻せません。
        </p>
        {error && (
          <p role="alert" className="mt-3 text-[length:var(--font-size-sm)] text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={pending}
            className={`${secondary} border border-border hover:bg-surface disabled:opacity-50`}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className={`${secondary} bg-text text-bg disabled:opacity-50`}
          >
            {pending ? '削除中…' : '削除'}
          </button>
        </div>
      </dialog>
    </>
  );
}
