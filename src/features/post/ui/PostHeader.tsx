import type { ReactNode } from 'react';
import { formatRelativeTime } from '../../../shared/time/relative-time';
import type { PostView } from '../model/schema';
import { PostMenu } from './PostMenu';

/**
 * The author, the time and the "…" menu of a post. The feed's card is 56px high and the post's own
 * screen 60px. `ownerItems` are the author's own rows of the menu (delete).
 */
export function PostHeader({
  post,
  now,
  ownerItems,
  height,
  className = '',
}: {
  post: PostView;
  /** The current time in epoch ms; a screen that renders many cards passes one value to all. */
  now?: number;
  ownerItems?: ReactNode;
  height: 56 | 60;
  className?: string;
}) {
  const { author } = post;
  const createdAt = new Date(post.createdAt);
  return (
    <header
      className={`flex items-center gap-3 px-3 ${height === 60 ? 'h-[60px]' : 'h-14'} ${className}`}
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-[length:var(--font-size-sm)] font-semibold text-text"
        >
          {Array.from(author.username)[0]?.toUpperCase()}
        </span>
      )}
      <a
        href={`/${author.username}`}
        className="block min-w-[var(--tap-min)] truncate leading-[var(--tap-min)] text-[length:var(--font-size-sm)] font-semibold"
      >
        {author.username}
      </a>
      <span aria-hidden="true" className="text-text-secondary">
        •
      </span>
      <a
        href={`/p/${post.id}`}
        className="block min-w-[var(--tap-min)] shrink-0 leading-[var(--tap-min)] text-[length:var(--font-size-sm)] text-text-secondary"
      >
        <time dateTime={createdAt.toISOString()} suppressHydrationWarning>
          {formatRelativeTime(createdAt, now ?? Date.now())}
        </time>
      </a>
      <div className="ml-auto flex shrink-0 items-center">
        <PostMenu postId={post.id} ownerItems={ownerItems} />
      </div>
    </header>
  );
}
