import { formatRelativeTime } from '../../../shared/time/relative-time';
import type { CommentView } from '../model/schema';

const action =
  'min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-lg px-2 text-[length:var(--font-size-xs)] font-bold text-text-secondary hover:bg-surface hover:text-text';

/** A comment that has been added but not yet answered by the server has a temporary id. */
export const isPending = (comment: CommentView): boolean => comment.id.startsWith('tmp-');

/**
 * One comment or reply as a list row. A reply is indented one level (the list is flat, so a
 * reply's reply sits at the same level). The buttons carry the author's name for screen readers.
 */
export function CommentItem({
  comment,
  isReply,
  now,
  canReply,
  onReply,
  onDelete,
}: {
  comment: CommentView;
  isReply: boolean;
  now: number;
  canReply: boolean;
  onReply: (comment: CommentView) => void;
  onDelete: (comment: CommentView, trigger: HTMLButtonElement) => void;
}) {
  const { author } = comment;
  const pending = isPending(comment);
  const createdAt = new Date(comment.createdAt);
  return (
    <li
      id={`comment-${comment.id}`}
      data-reply={isReply ? 'true' : undefined}
      aria-busy={pending ? 'true' : undefined}
      className={`flex gap-3 py-2 ${isReply ? 'ml-11' : ''} ${pending ? 'opacity-60' : ''}`}
    >
      {author.avatarUrl ? (
        <img
          src={author.avatarUrl}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded-full bg-surface object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-[length:var(--font-size-sm)] font-bold text-text"
        >
          {Array.from(author.username)[0]?.toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[length:var(--font-size-sm)] break-words whitespace-pre-wrap">
          <a href={`/${author.username}`} className="font-bold">
            {author.username}
          </a>{' '}
          <span>{comment.body}</span>
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <time
            dateTime={createdAt.toISOString()}
            suppressHydrationWarning
            className="text-[length:var(--font-size-xs)] text-text-secondary"
          >
            {formatRelativeTime(createdAt, now)}
          </time>
          {canReply && !pending && (
            <button
              type="button"
              aria-label={`@${author.username} に返信する`}
              onClick={() => onReply(comment)}
              className={action}
            >
              返信する
            </button>
          )}
          {comment.canDelete && !pending && (
            <button
              type="button"
              aria-label={`@${author.username} のコメントを削除`}
              onClick={(e) => onDelete(comment, e.currentTarget)}
              className={action}
            >
              削除
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
