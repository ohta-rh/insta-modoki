import type { FormEvent, Ref } from 'react';
import { charLength } from '../../../shared/text';
import { addCommentFormAction } from '../api/actions';
import { COMMENT_INPUT_ID } from './comment-input-id';
import { MAX_BODY } from '../model/limits';
import type { ReplyTarget } from '../model/thread';

/** The counter shows from here on (the limit is 2,200). */
const COUNTER_FROM = 2000;

/**
 * The comment box, fixed to the bottom of the screen (above the bottom nav on a narrow one). It is
 * a real form: before the page's scripts load, "投稿" posts it to a Server Action; once they load,
 * `onSubmit` takes over and adds the row without leaving the page. The button is only disabled
 * for an empty box after hydration (`ready`), so the native path stays usable.
 */
export function CommentForm({
  postId,
  requestId,
  draft,
  replyTo,
  error,
  ready,
  inputRef,
  onDraftChange,
  onSubmit,
  onCancelReply,
}: {
  postId: string;
  /** The id the native (no script) path sends as `clientRequestId`. */
  requestId: string;
  draft: string;
  replyTo: ReplyTarget | null;
  error: string | null;
  ready: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelReply: () => void;
}) {
  const length = charLength(draft);
  const empty = draft.trim() === '';
  return (
    <form
      action={addCommentFormAction}
      onSubmit={onSubmit}
      data-testid="comment-form"
      className="sticky bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] z-30 border-t border-border bg-bg px-3 py-2 nav:bottom-0"
    >
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="clientRequestId" value={requestId} />
      {replyTo && <input type="hidden" name="parentId" value={replyTo.parentId} />}
      {replyTo && (
        <p className="mb-1 flex items-center gap-2 text-[length:var(--font-size-sm)] text-text-secondary">
          <span>{`@${replyTo.username} に返信中`}</span>
          <button
            type="button"
            onClick={onCancelReply}
            className="min-h-[var(--tap-min)] rounded-lg px-2 font-bold"
          >
            返信をやめる
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="mb-1 text-[length:var(--font-size-sm)] text-red-700">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <label htmlFor={COMMENT_INPUT_ID} className="sr-only">
          コメントを追加
        </label>
        <input
          ref={inputRef}
          id={COMMENT_INPUT_ID}
          name="body"
          type="text"
          required
          autoComplete="off"
          placeholder="コメントを追加…"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          className="min-h-[var(--tap-min)] min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-[length:var(--font-size-md)] text-text"
        />
        <button
          type="submit"
          disabled={ready && empty}
          className="min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-lg px-3 text-[length:var(--font-size-sm)] font-bold text-indigo disabled:opacity-40"
        >
          投稿
        </button>
      </div>
      {length >= COUNTER_FROM && (
        <p
          aria-live="polite"
          className={`mt-1 text-right text-[length:var(--font-size-xs)] ${length > MAX_BODY ? 'text-red-700' : 'text-text-muted'}`}
        >
          {`${length} / 2,200`}
        </p>
      )}
    </form>
  );
}
