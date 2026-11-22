import { SaveButton } from '../../bookmark';
import { CommentCountLink, CommentCountProvider } from '../../comment';
import { DoubleTapLike, LikeButton, LikeScope, LikersDialog } from '../../like';
import { PostCard, type PostView } from '../../post';

/**
 * One post of the feed: the shared card with the like controls (#34) and the comment count link
 * (#35) wired the way the post's own screen wires them, plus "コメント N 件をすべて見る". The
 * comments themselves are not listed here; the heart is a form, so it works before hydration.
 */
export function FeedPostCard({
  post,
  now,
  priority,
}: {
  post: PostView;
  now: number;
  priority: boolean;
}) {
  const postHref = `/p/${post.id}`;
  return (
    <CommentCountProvider initialCount={post.commentCount}>
      <LikeScope postId={post.id} initialLiked={post.likedByMe} initialCount={post.likeCount}>
        <PostCard
          post={post}
          now={now}
          priority={priority}
          wrapMedia={(media) => <DoubleTapLike>{media}</DoubleTapLike>}
          like={
            <>
              <LikeButton />
              <LikersDialog />
            </>
          }
          comment={<CommentCountLink href={postHref} />}
          save={<SaveButton postId={post.id} initialSaved={post.savedByMe} />}
          footer={
            post.commentCount > 0 ? (
              <a
                href={postHref}
                className="mt-1 block text-[length:var(--font-size-sm)] text-text-secondary"
              >
                {`コメント ${post.commentCount} 件をすべて見る`}
              </a>
            ) : null
          }
        />
      </LikeScope>
    </CommentCountProvider>
  );
}
