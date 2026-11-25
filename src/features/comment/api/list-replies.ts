import { and, eq } from 'drizzle-orm';
import { getSessionUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { comments, posts, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { isId, PAGE_SIZE, type CommentView, type Page } from '../model/schema';
import { commentColumns, toCommentView, type CommentRow } from './comment-view';
import { afterCursor, oldestFirst, readCursor, toPage } from './page';

export type ListRepliesDeps = { env?: AuthEnv & StorageEnv; headers: Headers };

/**
 * One page (20) of a top-level comment's replies, oldest first. Anyone may read it. A comment
 * that does not exist, or is itself a reply, is NOT_FOUND; a broken cursor is VALIDATION.
 */
export async function listReplies(
  input: unknown,
  deps: ListRepliesDeps,
): Promise<Page<CommentView>> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const { commentId, cursor: rawCursor } = (input ?? {}) as {
    commentId?: unknown;
    cursor?: unknown;
  };
  if (!isId(commentId)) throw new AppError('NOT_FOUND');
  const cursor = readCursor(rawCursor);

  const viewer = await getSessionUser(deps.headers, { env });
  const db = getDb(env);
  const [parent] = await db
    .select({ parentId: comments.parentId, postAuthorId: posts.authorId })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(eq(comments.id, commentId));
  if (!parent || parent.parentId !== null) throw new AppError('NOT_FOUND');

  const rows: CommentRow[] = await db
    .select(commentColumns)
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(and(eq(comments.parentId, commentId), afterCursor(cursor)))
    .orderBy(...oldestFirst)
    .limit(PAGE_SIZE + 1);
  const page = toPage(rows);
  return {
    items: page.items.map((r) => toCommentView(env, r, viewer, parent.postAuthorId)),
    nextCursor: page.nextCursor,
  };
}
