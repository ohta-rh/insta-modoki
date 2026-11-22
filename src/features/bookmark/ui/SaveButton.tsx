'use client';

import { useEffect, useRef, useState } from 'react';
import { BookmarkFilledIcon, BookmarkIcon } from '../../../shared/ui/icons';
import { saveAction, saveFormAction } from '../api/actions';
import { createSaveController, type SaveSnapshot } from '../model/save-controller';

/**
 * The bookmark. It is a `<form>` whose Server Action sets the wanted state, so it works before the
 * page is hydrated; once hydrated the submit is taken over for the optimistic update. The state is
 * told by shape (outline / filled), by `aria-pressed` and by a polite live message, not by colour
 * alone. The server's message of a failure is shown in `role="alert"`.
 */
export function SaveButton({ postId, initialSaved }: { postId: string; initialSaved: boolean }) {
  const [snapshot, setSnapshot] = useState<SaveSnapshot>({
    saved: initialSaved,
    error: null,
    needsLogin: false,
    touched: 0,
  });
  const controller = useRef<ReturnType<typeof createSaveController> | null>(null);
  if (controller.current === null) {
    controller.current = createSaveController({
      initial: { saved: initialSaved },
      send: async (saved) => {
        const result = await saveAction({ postId, saved });
        return result.ok
          ? result
          : { ok: false, code: result.error.code, message: result.error.message };
      },
      onChange: setSnapshot,
    });
  }
  const { saved, error, needsLogin, touched } = snapshot;

  useEffect(() => {
    if (needsLogin) window.location.assign('/accounts/login');
  }, [needsLogin]);

  return (
    <>
      <form
        action={saveFormAction}
        onSubmit={(e) => {
          e.preventDefault();
          controller.current?.press();
        }}
        className="ml-auto"
      >
        <input type="hidden" name="postId" value={postId} />
        <input type="hidden" name="save" value={saved ? '0' : '1'} />
        <button
          type="submit"
          aria-pressed={saved}
          aria-label="保存"
          data-testid="save-button"
          className="flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center rounded-full hover:bg-surface"
        >
          {saved ? <BookmarkFilledIcon /> : <BookmarkIcon />}
        </button>
      </form>
      <span aria-live="polite" className="sr-only">
        {touched > 0 ? (saved ? '保存しました' : '保存を取り消しました') : ''}
      </span>
      {error && (
        <p
          role="alert"
          className="order-last basis-full px-2 pb-1 text-[length:var(--font-size-sm)] text-red-700"
        >
          {error}
        </p>
      )}
    </>
  );
}
