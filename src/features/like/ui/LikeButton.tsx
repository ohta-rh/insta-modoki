'use client';

import { HeartFilledIcon, HeartIcon } from '../../../shared/ui/icons';
import { likeFormAction } from '../api/actions';
import { useLikeScope } from './LikeScope';

/**
 * The heart. It is a `<form>` whose Server Action sets the wanted state, so it works before the
 * page is hydrated; once hydrated the submit is taken over for the optimistic update. The state
 * is told by shape (outline / filled), by `aria-pressed` and by a polite live message, not by
 * colour alone. The server's message of a failure is shown in `role="alert"`.
 */
export function LikeButton() {
  const { postId, snapshot, press } = useLikeScope();
  const { liked, count, error, touched } = snapshot;
  return (
    <>
      <form
        action={likeFormAction}
        onSubmit={(e) => {
          e.preventDefault();
          press();
        }}
        className="contents"
      >
        <input type="hidden" name="postId" value={postId} />
        <input type="hidden" name="like" value={liked ? '0' : '1'} />
        <button
          type="submit"
          aria-pressed={liked}
          aria-label="いいね"
          data-testid="like-button"
          className="flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center rounded-full hover:bg-surface"
        >
          {liked ? <HeartFilledIcon className="text-red-600" /> : <HeartIcon />}
        </button>
      </form>
      <span aria-live="polite" className="sr-only">
        {touched > 0 ? `${liked ? 'いいね済み' : 'いいねを取り消しました'}（${count} 件）` : ''}
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
