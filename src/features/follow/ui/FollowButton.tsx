'use client';

import { followFormAction } from '../api/actions';
import { useFollowScope } from './FollowScope';

const BASE =
  'inline-flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center rounded-lg px-4 text-[length:var(--font-size-sm)] font-bold';
// The small coloured word of a list row (the home's right column): "フォロー" / "フォロー中".
const TEXT =
  'inline-flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center px-2 text-[length:var(--font-size-xs)] font-semibold';

/**
 * The follow button. It is a `<form>` whose Server Action sets the wanted state, so it works before
 * the page is hydrated; once hydrated the submit is taken over for the optimistic update. The state
 * is told by the label ("フォローする" / "フォロー中"), by `aria-pressed` and by a polite live
 * message. The server's message of a failure is shown in `role="alert"`. A visitor who is not
 * signed in gets a link to the login page. `variant="text"` is the list row's coloured word.
 */
export function FollowButton({ variant = 'button' }: { variant?: 'button' | 'text' }) {
  const { username, signedIn, snapshot, press } = useFollowScope();
  const { following, count, error, touched } = snapshot;
  const text = variant === 'text';
  if (!signedIn) {
    return (
      <a
        href="/accounts/login"
        className={text ? `${TEXT} text-indigo` : `${BASE} bg-link text-white`}
      >
        {text ? 'フォロー' : 'フォローする'}
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
          className={
            text
              ? `${TEXT} ${following ? 'text-text' : 'text-indigo'}`
              : `${BASE} ${following ? 'bg-surface text-text' : 'bg-link text-white'}`
          }
        >
          {following ? 'フォロー中' : text ? 'フォロー' : 'フォローする'}
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
