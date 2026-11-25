'use client';

import { useActionState } from 'react';
import { logOutAction } from '../api/actions';

/** A POST form: opening the page (or prefetching its link) never ends the session. */
export function LogOutConfirm() {
  const [, action, pending] = useActionState(async () => logOutAction(), undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <button
        type="submit"
        disabled={pending}
        className="min-h-[var(--tap-min)] rounded-lg bg-indigo px-4 font-bold text-white disabled:opacity-50"
      >
        ログアウト
      </button>
    </form>
  );
}
