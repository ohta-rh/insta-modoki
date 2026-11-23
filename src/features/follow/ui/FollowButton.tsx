'use client';

import { followFormAction } from '../api/actions';
import { useFollowScope } from './FollowScope';

const BASE =
  'inline-flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center rounded-lg px-4 text-[length:var(--font-size-sm)] font-bold';

/**
 * The follow button. It is a `<form>` whose Server Action sets the wanted state, so it works before
 * the page is hydrated; once hydrated the submit is taken over for the optimistic update. The state
 * is told by the label ("フォローする" / "フォロー中"), by `aria-pressed` and by a polite live
 * message. The server's message of a failure is shown in `role="alert"`. A visitor who is not
 * signed in gets a link to the login page.
 */
export function FollowButton() {
  const { username, signedIn, snapshot, press } = useFollowScope();
  const { following, count, error, touched } = snapshot;
  if (!signedIn) {
    return (
      <a href="/accounts/login" className={`${BASE} bg-link text-white`}>
        フォローする
      </a>
    );
  }
  return (
    <>
      <form
        action={followFormAction}
        onSubmit={(e) => {
          e.preventDefault();
          press();
        }}
        className="contents"
      >
        <input type="hidden" name="username" value={username} />
        <input type="hidden" name="follow" value={following ? '0' : '1'} />
        <button
          type="submit"
          aria-pressed={following}
          className={`${BASE} ${following ? 'bg-surface text-text' : 'bg-link text-white'}`}
        >
          {following ? 'フォロー中' : 'フォローする'}
        </button>
      </form>
      <span aria-live="polite" className="sr-only">
        {touched > 0
          ? `${following ? 'フォローしました' : 'フォローを解除しました'}（フォロワー ${count} 人）`
          : ''}
      </span>
      {error && (
        <p role="alert" className="basis-full text-[length:var(--font-size-sm)] text-danger">
          {error}
        </p>
      )}
    </>
  );
}
