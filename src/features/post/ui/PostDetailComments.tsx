import { type CommentView, type Page } from '../../comment';
import { CommentSection } from '../../comment/ui';

/**
 * The comments under a post's card (#35). The route reads the first page (anyone may read it) and
 * the viewer; the box to write is for a signed-in visitor only. Put inside `CommentCountProvider`.
 */
export function PostDetailComments({
  postId,
  viewer,
  comments,
  requestId,
}: {
  postId: string;
  viewer: { username: string } | null;
  comments: Page<CommentView>;
  /** The id the form's no-script path sends as `clientRequestId`. */
  requestId: string;
}) {
  return (
    <CommentSection postId={postId} viewer={viewer} initial={comments} requestId={requestId} />
  );
}
