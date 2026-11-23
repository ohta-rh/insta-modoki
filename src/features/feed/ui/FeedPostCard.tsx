import { SaveButton } from '../../bookmark/ui';
import {
  CommentCountAllLink,
  CommentCountLink,
  CommentCountProvider,
  FeedCommentField,
} from '../../comment/ui';
import { DoubleTapLike, LikeButton, LikeScope, LikersDialog } from '../../like/ui';
import { type PostView } from '../../post';
import { PostCard } from '../../post/ui';

/**
 * One post of the feed: the shared card with the like controls (#34) and the comment count link
 * (#35) wired the way the post's own screen wires them, plus "コメント N 件をすべて見る" and the
 * comment field. The comments themselves are not listed here; the heart is a form, so it works before hydration.
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
          like={<LikeButton />}
          likes={<LikersDialog />}
          comment={<CommentCountLink href={postHref} />}
          save={<SaveButton postId={post.id} initialSaved={post.savedByMe} />}
          footer={
            <>
              <CommentCountAllLink href={postHref} />
              <FeedCommentField postId={post.id} requestId={crypto.randomUUID()} />
            </>
          }
        />
      </LikeScope>
    </CommentCountProvider>
  );
}
