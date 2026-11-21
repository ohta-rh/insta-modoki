import type { ReactNode } from 'react';
import { formatRelativeTime } from '../../../shared/time/relative-time';
import type { PostView } from '../model/schema';
import { Carousel } from './Carousel';
import { PostActionBar } from './PostActionBar';

/**
 * One post: the author, the photos, the action row, the caption and the time. The feed (#44)
 * and the modal (#41) use it too. `menu` is the author's own controls (delete); `like` and
 * `comment` fill the action row's slots.
 */
export function PostCard({
  post,
  now,
  priority = false,
  menu,
  like,
  comment,
  wrapMedia,
  footer,
}: {
  post: PostView;
  /** The current time in epoch ms; a screen that renders many cards passes one value to all. */
  now?: number;
  /** The first photo is loaded eagerly: set it on the top card of a screen only. */
  priority?: boolean;
  menu?: ReactNode;
  like?: ReactNode;
  comment?: ReactNode;
  /** Wraps the photos (the like slice's double tap goes here). */
  wrapMedia?: (media: ReactNode) => ReactNode;
  /** Under the caption, above the time (the feed's link to all the comments). */
  footer?: ReactNode;
}) {
  const { author } = post;
  const createdAt = new Date(post.createdAt);
  return (
    <article className="w-full bg-bg">
      <header className="flex items-center gap-3 px-3 py-3">
        {author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-full bg-surface object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-[length:var(--font-size-sm)] font-bold text-text-secondary"
          >
            {Array.from(author.username)[0]?.toUpperCase()}
          </span>
        )}
        <a
          href={`/${author.username}`}
          className="min-w-0 flex-1 truncate text-[length:var(--font-size-sm)] font-bold"
        >
          {author.username}
        </a>
        {menu}
      </header>
      {wrapMedia ? (
        wrapMedia(<Carousel media={post.media} username={author.username} priority={priority} />)
      ) : (
        <Carousel media={post.media} username={author.username} priority={priority} />
      )}
      <PostActionBar like={like} comment={comment} />
      <div className="px-3 pb-4">
        {post.caption !== '' && (
          <p className="text-[length:var(--font-size-sm)] break-words whitespace-pre-wrap">
            <a href={`/${author.username}`} className="font-bold">
              {author.username}
            </a>{' '}
            {post.caption}
          </p>
        )}
        {footer}
        <time
          dateTime={createdAt.toISOString()}
          suppressHydrationWarning
          className="mt-1 block text-[length:var(--font-size-xs)] text-text-muted"
        >
          {formatRelativeTime(createdAt, now ?? Date.now())}
        </time>
      </div>
    </article>
  );
}
