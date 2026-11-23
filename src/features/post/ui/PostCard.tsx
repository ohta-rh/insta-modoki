import type { ReactNode } from 'react';
import { CaptionText } from '../../../shared/ui/CaptionText';
import { formatRelativeTime } from '../../../shared/time/relative-time';
import type { PostView } from '../model/schema';
import { Carousel } from './Carousel';
import { CaptionClamp } from './CaptionClamp';
import { PostActionBar } from './PostActionBar';
import { PostMenu } from './PostMenu';

/**
 * One post: the author with the time and the "…" menu, the photos, the action row, the likes line,
 * the two-line caption. The feed (#44)
 * and the modal (#41) use it too. `menu` is the author's own controls (delete); `like`,
 * `comment` and `save` fill the action row's slots.
 */
export function PostCard({
  post,
  now,
  priority = false,
  menu,
  like,
  likes,
  comment,
  save,
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
  /** The line under the action row ("N 件のいいね"). */
  likes?: ReactNode;
  comment?: ReactNode;
  save?: ReactNode;
  /** Wraps the photos (the like slice's double tap goes here). */
  wrapMedia?: (media: ReactNode) => ReactNode;
  /** Under the caption (the feed's link to all the comments and the comment field). */
  footer?: ReactNode;
}) {
  const { author } = post;
  const createdAt = new Date(post.createdAt);
  return (
    <article className="w-full border-b border-border bg-bg pb-4">
      <header className="flex h-14 items-center gap-3 px-3">
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
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-[length:var(--font-size-sm)] font-semibold text-text"
          >
            {Array.from(author.username)[0]?.toUpperCase()}
          </span>
        )}
        <a
          href={`/${author.username}`}
          className="min-w-0 truncate text-[length:var(--font-size-sm)] font-semibold"
        >
          {author.username}
        </a>
        <span aria-hidden="true" className="text-text-secondary">
          •
        </span>
        <a
          href={`/p/${post.id}`}
          className="shrink-0 text-[length:var(--font-size-sm)] text-text-secondary"
        >
          <time dateTime={createdAt.toISOString()} suppressHydrationWarning>
            {formatRelativeTime(createdAt, now ?? Date.now())}
          </time>
        </a>
        <div className="ml-auto flex shrink-0 items-center">
          {menu}
          <PostMenu postId={post.id} />
        </div>
      </header>
      {wrapMedia ? (
        wrapMedia(<Carousel media={post.media} username={author.username} priority={priority} />)
      ) : (
        <Carousel media={post.media} username={author.username} priority={priority} />
      )}
      <PostActionBar like={like} comment={comment} save={save} />
      {likes && <div className="px-3">{likes}</div>}
      {post.caption !== '' && (
        <div className="px-3">
          <CaptionClamp postId={post.id}>
            <a href={`/${author.username}`} tabIndex={-1} className="font-semibold">
              {author.username}
            </a>{' '}
            <CaptionText caption={post.caption} />
          </CaptionClamp>
        </div>
      )}
      {footer}
    </article>
  );
}
