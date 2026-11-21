import { comments, users } from '../../../shared/db/schema';
import { avatarUrl, type StorageEnv } from '../../../shared/storage';
import type { CommentView } from '../model/schema';

/** The columns of a comment joined with its author, as every read selects them. */
export type CommentRow = {
  id: string;
  authorId: string;
  parentId: string | null;
  body: string;
  createdAt: Date;
  username: string;
  displayName: string;
  avatarKey: string | null;
};

/** The columns every comment read selects. */
export const commentColumns = {
  id: comments.id,
  authorId: comments.authorId,
  parentId: comments.parentId,
  body: comments.body,
  createdAt: comments.createdAt,
  username: users.username,
  displayName: users.displayName,
  avatarKey: users.avatarKey,
};

/** One row as a screen shows it. `canDelete` is for the comment's author and the post's author. */
export function toCommentView(
  env: Pick<StorageEnv, 'S3_ENDPOINT' | 'S3_BUCKET'> & { S3_PUBLIC_BASE_URL?: string },
  row: CommentRow,
  viewer: { id: string } | null,
  postAuthorId: string,
): CommentView {
  return {
    id: row.id,
    author: {
      username: row.username,
      displayName: row.displayName,
      avatarUrl: avatarUrl(env, row.avatarKey),
    },
    body: row.body,
    parentId: row.parentId,
    createdAt: row.createdAt.toISOString(),
    canDelete: viewer !== null && (row.authorId === viewer.id || postAuthorId === viewer.id),
  };
}
