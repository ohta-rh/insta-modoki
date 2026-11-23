import type { CSSProperties } from 'react';
import { SaveButton } from '../../bookmark/ui';
import { type CommentView, type Page } from '../../comment';
import { CommentCountLink, CommentCountProvider } from '../../comment/ui';
import { DoubleTapLike, LikeButton, LikeScope, LikersDialog } from '../../like/ui';
import { formatRelativeTime } from '../../../shared/time/relative-time';
import type { PostView } from '../model/schema';
import { Carousel } from './Carousel';
import { DeletePostButton } from './DeletePostButton';
import { PostActionBar } from './PostActionBar';
import { PostDetailComments } from './PostDetailComments';
import { PostHeader } from './PostHeader';

/**
 * The post's own screen. From 1024px it is two columns in a bordered box: the photos on the left
 * (black, the photo's own ratio at `--post-h` high) and a 335px column on the right: header,
 * caption and comments (the only part that scrolls), actions, comment box. Below 1024px it is one
 * column, at most 470px. The profile's modal puts the same box in a larger `--post-h`.
 */
export function PostDetail({
  post,
  isOwner,
  viewer,
  comments,
  requestId,
}: {
  post: PostView;
  isOwner: boolean;
  viewer: { username: string } | null;
  /** The first page of comments, read by the route. */
  comments: Page<CommentView>;
  requestId: string;
}) {
  const first = post.media[0];
  const ratio = first ? first.width / first.height : 1;
  const createdAt = new Date(post.createdAt);
  const now = Date.now();
  return (
    <div
      data-page-width="wide"
      className="mx-auto w-full max-w-[var(--feed-width)] lg:w-fit lg:max-w-none"
    >
      <h1 className="sr-only">{`@${post.author.username} の投稿`}</h1>
      <CommentCountProvider initialCount={post.commentCount}>
        <article
          data-post-detail
          style={{ '--media-ratio': ratio } as CSSProperties}
          className="flex flex-col bg-bg lg:box-content lg:grid lg:h-[var(--post-h,600px)] lg:grid-cols-[auto_var(--post-aside-width)] lg:grid-rows-[auto_1fr_auto_auto] lg:border lg:border-border"
        >
          <PostHeader
            post={post}
            now={now}
            height={60}
            className="border-b border-border lg:[grid-area:1/2]"
            ownerItems={
              isOwner ? (
                <DeletePostButton
                  postId={post.id}
                  username={post.author.username}
                  variant="menu-item"
                />
              ) : null
            }
          />
          <LikeScope postId={post.id} initialLiked={post.likedByMe} initialCount={post.likeCount}>
            <div
              data-post-media
              className="bg-black lg:h-full lg:w-[min(calc(var(--post-h,600px)*var(--media-ratio)),calc(100vw-335px-80px))] lg:border-r lg:border-border lg:[&>div]:h-full lg:[grid-area:1/1/5/2]"
            >
              <DoubleTapLike>
                <Carousel media={post.media} username={post.author.username} priority fill />
              </DoubleTapLike>
            </div>
            <div data-post-meta className="lg:border-t lg:border-highlight lg:[grid-area:3/2]">
              <PostActionBar
                like={<LikeButton />}
                comment={<CommentCountLink />}
                save={<SaveButton postId={post.id} initialSaved={post.savedByMe} />}
              />
              <div className="px-3">
                <LikersDialog />
              </div>
              <time
                dateTime={createdAt.toISOString()}
                suppressHydrationWarning
                className="block px-3 pb-3 text-[length:var(--font-size-xs)] text-text-secondary"
              >
                {formatRelativeTime(createdAt, now)}
              </time>
            </div>
          </LikeScope>
          <PostDetailComments
            post={post}
            now={now}
            viewer={viewer}
            comments={comments}
            requestId={requestId}
          />
        </article>
      </CommentCountProvider>
    </div>
  );
}
