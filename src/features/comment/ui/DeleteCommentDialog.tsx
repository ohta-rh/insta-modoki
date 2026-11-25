import type { KeyboardEvent, Ref } from 'react';
import { trapTab } from '../../../shared/ui/focus-trap';

const button =
  'min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-lg px-4 text-[length:var(--font-size-sm)] font-bold';

/** Tab and Shift+Tab wrap inside the dialog. */
function trapFocus(e: KeyboardEvent<HTMLDialogElement>) {
  trapTab(e, e.currentTarget);
}

/**
 * "このコメントを削除しますか？" (role alertdialog, a modal `<dialog>`): the focus stays inside,
 * Escape and "キャンセル" close it. The section opens it with `showModal()` and keeps the one
 * dialog for every comment.
 */
export function DeleteCommentDialog({
  dialogRef,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  dialogRef: Ref<HTMLDialogElement>;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="delete-comment-title"
      aria-describedby="delete-comment-message"
      // Escape is ignored while the request is running.
      onCancel={(e) => pending && e.preventDefault()}
      onClose={onClose}
      onKeyDown={trapFocus}
      className="m-auto w-[min(92vw,360px)] rounded-xl bg-bg p-5 text-text shadow-xl backdrop:bg-black/50"
    >
      <h2 id="delete-comment-title" className="text-[length:var(--font-size-md)] font-bold">
        このコメントを削除しますか？
      </h2>
      <p
        id="delete-comment-message"
        className="mt-2 text-[length:var(--font-size-sm)] text-text-secondary"
      >
        削除したコメントは元に戻せません。返信もまとめて消えます。
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
          className={`${button} border border-border hover:bg-surface aria-disabled:opacity-50`}
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={onConfirm}
          aria-disabled={pending || undefined}
          className={`${button} bg-text text-bg aria-disabled:opacity-50`}
        >
          {pending ? '削除中…' : '削除'}
        </button>
      </form>
    </dialog>
  );
}
