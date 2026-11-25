'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { addCommentAction, addCommentFormAction } from '../api/actions';
import { submitFeedComment } from '../model/feed-comment';
import { useCommentCount } from './CommentCount';

export const COMMENT_POSTED_MESSAGE = 'コメントを投稿しました';

/**
 * The borderless "コメントを追加…" line under a feed card. A real form: before the scripts load,
 * "投稿" posts it to a Server Action that saves and goes to the post's screen; once hydrated,
 * `onSubmit` sends it in place, empties the box, announces it and moves the card's comment count.
 * `requestId` (made by the server) is the idempotency key of the sending; it is kept across a
 * failure and renewed after a success.
 */
export function FeedCommentField({ postId, requestId }: { postId: string; requestId: string }) {
  const { add } = useCommentCount();
  const [draft, setDraft] = useState('');
  const [id, setId] = useState(requestId);
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [posted, setPosted] = useState('');
  const inputId = `feed-comment-${postId}`;

  useEffect(() => setReady(true), []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending || draft.trim() === '') return;
    setSending(true);
    setError('');
    setPosted('');
    const outcome = await submitFeedComment({
      postId,
      body: draft,
      requestId: id,
      send: addCommentAction,
      newId: () => crypto.randomUUID(),
    });
    setSending(false);
    if (outcome.ok) {
      setDraft('');
      setId(outcome.requestId);
      add(1);
      setPosted(COMMENT_POSTED_MESSAGE);
    } else {
      setError(outcome.message);
    }
  };

  return (
    <div>
      <form
        action={addCommentFormAction}
        onSubmit={(e) => void onSubmit(e)}
        className="flex items-center"
      >
        <input type="hidden" name="postId" value={postId} />
        <input type="hidden" name="clientRequestId" value={id} />
        <label htmlFor={inputId} className="sr-only">
          コメントを追加
        </label>
        <input
          id={inputId}
          name="body"
          type="text"
          required
          autoComplete="off"
          placeholder="コメントを追加…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-[var(--tap-min)] min-w-0 flex-1 border-0 bg-transparent px-3 text-[length:var(--font-size-md)] text-text placeholder:text-text-secondary nav:text-[length:var(--font-size-sm)]"
        />
        <button
          type="submit"
          disabled={ready && draft.trim() === ''}
          className="min-h-[var(--tap-min)] px-3 text-[length:var(--font-size-sm)] font-semibold text-indigo disabled:opacity-40"
        >
          投稿
        </button>
      </form>
      {error && (
        <p role="alert" className="px-3 pb-2 text-[length:var(--font-size-sm)] text-danger">
          {error}
        </p>
      )}
      <div role="status" className="sr-only">
        {posted}
      </div>
    </div>
  );
}
