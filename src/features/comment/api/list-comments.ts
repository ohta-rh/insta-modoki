import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import { getSessionUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { comments, posts, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { INLINE_REPLIES, isId, PAGE_SIZE, type CommentView, type Page } from '../model/schema';
import { commentColumns, toCommentView, type CommentRow } from './comment-view';
import { afterCursor, oldestFirst, readCursor, toPage } from './page';

export type ListCommentsDeps = { env?: AuthEnv & StorageEnv; headers: Headers };

/**
 * One page (20) of a post's top-level comments, oldest first by (created_at, id), each with its
 * first 3 replies and its number of replies. Anyone may read it; `canDelete` is only true for a
 * signed-in comment author or post author. A missing post is NOT_FOUND; a broken cursor is VALIDATION.
 */
export async function listComments(
  input: unknown,
  deps: ListCommentsDeps,
): Promise<Page<CommentView>> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const { postId, cursor: rawCursor } = (input ?? {}) as { postId?: unknown; cursor?: unknown };
  if (!isId(postId)) throw new AppError('NOT_FOUND');
  const cursor = readCursor(rawCursor);

  const viewer = await getSessionUser(deps.headers, { env });
  const db = getDb(env);
  const [post] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!post) throw new AppError('NOT_FOUND');

  // One extra row says whether another page exists.
  const rows: CommentRow[] = await db
    .select(commentColumns)
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(and(eq(comments.postId, postId), isNull(comments.parentId), afterCursor(cursor)))
    .orderBy(...oldestFirst)
    .limit(PAGE_SIZE + 1);
  const page = toPage(rows);
  if (page.items.length === 0) return { items: [], nextCursor: null };

  const parentIds = page.items.map((r) => r.id);
  const [counts, ...firstReplies] = await db.batch([
    db
      .select({ parentId: comments.parentId, n: count() })
      .from(comments)
      .where(inArray(comments.parentId, parentIds))
      .groupBy(comments.parentId),
    ...parentIds.map((id) =>
      db
        .select(commentColumns)
        .from(comments)
        .innerJoin(users, eq(users.id, comments.authorId))
        .where(eq(comments.parentId, id))
        .orderBy(...oldestFirst)
        .limit(INLINE_REPLIES),
    ),
  ]);
  const replyCountOf = new Map(counts.map((c) => [c.parentId, c.n]));

  return {
    items: page.items.map((row, i) => ({
      ...toCommentView(env, row, viewer, post.authorId),
      replies: firstReplies[i]!.map((r) => toCommentView(env, r, viewer, post.authorId)),
      replyCount: replyCountOf.get(row.id) ?? 0,
    })),
    nextCursor: page.nextCursor,
  };
}
