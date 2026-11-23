import { type CommentView, type Page } from '../../comment';
import { CaptionRow, CommentSection } from '../../comment/ui';
import { CaptionText } from '../../../shared/ui/CaptionText';
import type { PostView } from '../model/schema';

/**
 * The caption and the comments of a post (#35). The route reads the first page (anyone may read
 * it) and the viewer; the box to write is for a signed-in visitor only. Put inside
 * `CommentCountProvider`. The caption is the first row of the list, shaped like a comment.
 */
export function PostDetailComments({
  post,
  now,
  viewer,
  comments,
  requestId,
}: {
  post: PostView;
  now: number;
  viewer: { username: string } | null;
  comments: Page<CommentView>;
  /** The id the form's no-script path sends as `clientRequestId`. */
  requestId: string;
}) {
  return (
    <CommentSection
      postId={post.id}
      viewer={viewer}
      initial={comments}
      requestId={requestId}
      before={
        post.caption === '' ? null : (
          <CaptionRow
            author={post.author}
            caption={<CaptionText caption={post.caption} />}
            createdAt={post.createdAt}
            now={now}
          />
        )
      }
    />
  );
}
