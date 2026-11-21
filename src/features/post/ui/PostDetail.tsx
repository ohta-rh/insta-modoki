import type { PostView } from '../model/schema';
import { DeletePostButton } from './DeletePostButton';
import { PostCard } from './PostCard';

/** The post's own screen: one card, at most 600px wide, with delete for its author. */
export function PostDetail({ post, isOwner }: { post: PostView; isOwner: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[600px]">
      <h1 className="sr-only">{`@${post.author.username} の投稿`}</h1>
      <PostCard
        post={post}
        priority
        menu={
          isOwner ? <DeletePostButton postId={post.id} username={post.author.username} /> : null
        }
      />
    </div>
  );
}
