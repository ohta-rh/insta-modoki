import { CommentCountLink, CommentCountProvider, type CommentView, type Page } from '../../comment';
import { DoubleTapLike, LikeButton, LikeScope, LikersDialog } from '../../like';
import type { PostView } from '../model/schema';
import { DeletePostButton } from './DeletePostButton';
import { PostCard } from './PostCard';
import { PostDetailComments } from './PostDetailComments';

/**
 * The post's own screen: one card, at most 600px wide, with the like controls (#34), the comment
 * count link (#35) and delete for its author, and the comments below it.
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
  return (
    <div className="mx-auto w-full max-w-[600px]">
      <h1 className="sr-only">{`@${post.author.username} の投稿`}</h1>
      <CommentCountProvider initialCount={post.commentCount}>
        <LikeScope postId={post.id} initialLiked={post.likedByMe} initialCount={post.likeCount}>
          <PostCard
            post={post}
            priority
            wrapMedia={(media) => <DoubleTapLike>{media}</DoubleTapLike>}
            like={
              <>
                <LikeButton />
                <LikersDialog />
              </>
            }
            comment={<CommentCountLink />}
            menu={
              isOwner ? <DeletePostButton postId={post.id} username={post.author.username} /> : null
            }
          />
        </LikeScope>
        <PostDetailComments
          postId={post.id}
          viewer={viewer}
          comments={comments}
          requestId={requestId}
        />
      </CommentCountProvider>
    </div>
  );
}
