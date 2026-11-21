import { DoubleTapLike, LikeButton, LikeScope, LikersDialog } from '../../like';
import type { PostView } from '../model/schema';
import { DeletePostButton } from './DeletePostButton';
import { PostCard } from './PostCard';

/**
 * The post's own screen: one card, at most 600px wide, with the like controls (#34) and delete for
 * its author.
 */
export function PostDetail({ post, isOwner }: { post: PostView; isOwner: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[600px]">
      <h1 className="sr-only">{`@${post.author.username} の投稿`}</h1>
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
          menu={
            isOwner ? <DeletePostButton postId={post.id} username={post.author.username} /> : null
          }
        />
      </LikeScope>
    </div>
  );
}
