import { headers } from 'next/headers';
import { getSessionUser } from '@/features/auth';
import { listComments } from '@/features/comment';
import { getPost, PostDetail } from '@/features/post';
import { PostModal } from '@/features/profile';
import { AppError } from '@/shared/errors';

// `(..)p` intercepts /p/<postId> when it is reached from a profile (a soft navigation from the
// grid). A direct load or a reload skips this file and gets the normal page (#28).
export default async function PostModalPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const requestHeaders = await headers();
  try {
    const post = await getPost({ postId }, { headers: requestHeaders });
    // The same reads as the normal page (src/app/p/[postId]/page.tsx).
    const [viewer, comments] = await Promise.all([
      getSessionUser(requestHeaders),
      listComments({ postId: post.id }, { headers: requestHeaders }),
    ]);
    return (
      <PostModal postId={postId}>
        <PostDetail
          post={post}
          isOwner={viewer?.username === post.author.username}
          viewer={viewer ? { username: viewer.username } : null}
          comments={comments}
          requestId={crypto.randomUUID()}
        />
      </PostModal>
    );
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') {
      return (
        <PostModal postId={postId}>
          <p className="p-6 text-[length:var(--font-size-md)] font-bold">{error.message}</p>
        </PostModal>
      );
    }
    throw error;
  }
}
