import type { ReactNode } from 'react';
import { formatRelativeTime } from '../../../shared/time/relative-time';
import type { CommentView } from '../model/schema';

const action =
  'min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-lg px-2 text-[length:var(--font-size-xs)] font-semibold text-text-secondary hover:bg-surface hover:text-text';

type Person = { username: string; avatarUrl: string | null };

function Avatar({ author }: { author: Person }) {
  return author.avatarUrl ? (
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
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-[length:var(--font-size-sm)] font-semibold text-text"
    >
      {Array.from(author.username)[0]?.toUpperCase()}
    </span>
  );
}

/** The first line of a row: the name, then the time at its right (14px). */
function NameAndTime({ author, createdAt, now }: { author: Person; createdAt: Date; now: number }) {
  return (
    <p className="text-[length:var(--font-size-sm)]">
      <a href={`/${author.username}`} className="inline-tap-link font-semibold">
        {author.username}
      </a>{' '}
      <time
        dateTime={createdAt.toISOString()}
        suppressHydrationWarning
        className="text-text-secondary"
      >
        {formatRelativeTime(createdAt, now)}
      </time>
    </p>
  );
}

const bodyClass =
  'text-[length:var(--font-size-sm)] leading-[var(--leading-sm)] break-words whitespace-pre-wrap';

/** The post's caption as the first row of the comments, in the same shape as a comment. */
export function CaptionRow({
  author,
  caption,
  createdAt,
  now,
}: {
  author: Person;
  caption: ReactNode;
  createdAt: string;
  now: number;
}) {
  return (
    <div data-caption className="flex gap-3 px-3 py-2">
      <Avatar author={author} />
      <div className="min-w-0 flex-1">
        <NameAndTime author={author} createdAt={new Date(createdAt)} now={now} />
        <p className={bodyClass}>{caption}</p>
      </div>
    </div>
  );
}

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
      <Avatar author={author} />
      <div className="min-w-0 flex-1">
        <NameAndTime author={author} createdAt={createdAt} now={now} />
        <p className={bodyClass}>{comment.body}</p>
        <div className="flex flex-wrap items-center">
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
