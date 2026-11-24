import type { ReactNode } from 'react';
import { CaptionText } from '../../../shared/ui/CaptionText';
import type { PostView } from '../model/schema';
import { Carousel } from './Carousel';
import { CaptionClamp } from './CaptionClamp';
import { PostActionBar } from './PostActionBar';
import { PostHeader } from './PostHeader';

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
  return (
    <article className="w-full border-b border-border bg-bg pb-4">
      <PostHeader post={post} now={now} ownerItems={menu} height={56} />
      {wrapMedia ? (
        wrapMedia(<Carousel media={post.media} username={author.username} priority={priority} />)
      ) : (
        <Carousel media={post.media} username={author.username} priority={priority} />
      )}
      <PostActionBar like={like} comment={comment} save={save} />
      {likes && <div className="px-3">{likes}</div>}
      {post.caption !== '' && (
        <div className="flex flex-col px-3">
          <CaptionClamp postId={post.id}>
            <a href={`/${author.username}`} tabIndex={-1} className="post-author-link">
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
