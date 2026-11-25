'use client';

import { INTERNAL_MESSAGE } from '../../../shared/errors';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { trapTab } from '../../../shared/ui/focus-trap';
import { supportsCommandInvokers } from '../../../shared/ui/supports-command-invokers';
import { deletePostAction } from '../api/actions';
import { usePostDeletedHandler } from './PostDeletedContext';

const secondary =
  'min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-lg px-4 text-[length:var(--font-size-sm)] font-bold';

/**
 * "削除" with a confirmation dialog (role alertdialog). The dialog traps the focus, Escape and
 * "キャンセル" close it and return the focus to the button, and "削除" goes to the author's page.
 */
export function DeletePostButton({ postId, username }: { postId: string; username: string }) {
  const router = useRouter();
  const onDeleted = usePostDeletedHandler();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  // aria-disabled buttons stay pressable, so a second press is dropped here.
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const messageId = useId();

  const dialogId = `delete-dialog-${postId}`;
  // The trigger opens the dialog by itself (commandfor), so it works before hydration; this
  // handler only clears an old error, and opens it where the command attribute is unsupported.
  const open = () => {
    setError(null);
    // Where commands are supported the browser opens it after this click; opening here too would
    // be a second, already-open showModal (a console warning).
    if (!supportsCommandInvokers() && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
    }
  };

  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await deletePostAction({ postId });
      if (result.ok) {
        // Inside the profile's modal the provider closes it; elsewhere go to the author's page.
        if (onDeleted) onDeleted(postId);
        else router.push(`/${username}`);
        return; // stays disabled until the navigation replaces the screen
      }
      setError(result.error.message);
    } catch {
      setError(INTERNAL_MESSAGE);
    }
    inFlight.current = false;
    setPending(false);
  };

  // Tab and Shift+Tab wrap inside the dialog.
  const trapFocus = (e: KeyboardEvent<HTMLDialogElement>) => trapTab(e, e.currentTarget);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        // Invoker commands are not in @types/react yet; React passes unknown attributes through.
        {...({ commandfor: dialogId, command: 'show-modal' } as object)}
        onClick={open}
        className={`${secondary} text-text-secondary hover:bg-surface`}
      >
        削除
      </button>
      <dialog
        ref={dialog}
        id={dialogId}
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
        <form method="dialog" className="mt-5 flex justify-end gap-2">
          <button
            type="submit"
            aria-disabled={pending || undefined}
            // Not `disabled`: that would drop the focus out of the dialog. Stay open while running.
            onClick={(e) => {
              if (pending) e.preventDefault();
            }}
            className={`${secondary} border border-border hover:bg-surface aria-disabled:opacity-50`}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={confirm}
            aria-disabled={pending || undefined}
            className={`${secondary} bg-text text-bg aria-disabled:opacity-50`}
          >
            {pending ? '削除中…' : '削除'}
          </button>
        </form>
      </dialog>
    </>
  );
}
