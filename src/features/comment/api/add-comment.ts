import { and, eq, sql } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb, type Db } from '../../../shared/db/client';
import { newId } from '../../../shared/db/id';
import { getRequestEnv } from '../../../shared/db/request';
import { comments, posts, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { consume } from '../../../shared/security/rate-limit';
import type { StorageEnv } from '../../../shared/storage';
import { parseAddComment, type CommentView } from '../model/schema';
import { commentColumns, toCommentView } from './comment-view';

/** 120 comments per hour per user (docs/architecture/conventions.md "上限とレート制限"). */
const HOURLY_LIMIT = 120;

export type AddCommentDeps = { env?: AuthEnv & StorageEnv; headers: Headers; now?: number };

/** Whether the error, or anything in its cause chain, has a message matching `pattern`. */
function hasMessage(error: unknown, pattern: RegExp): boolean {
  for (let e: unknown = error, i = 0; e && i < 5; i += 1) {
    if (pattern.test(e instanceof Error ? e.message : String(e))) return true;
    e = e instanceof Error ? e.cause : undefined;
  }
  return false;
}

const isRequestIdClash = (error: unknown): boolean =>
  hasMessage(error, /UNIQUE constraint failed: comments\.author_id, comments\.client_request_id/);

async function existingComment(db: Db, authorId: string, clientRequestId: string) {
  const [row] = await db
    .select(commentColumns)
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(and(eq(comments.authorId, authorId), eq(comments.clientRequestId, clientRequestId)))
    .limit(1);
  return row ?? null;
}

/**
 * Adds a comment, or a reply (one level: a reply to a reply is stored under the reply's parent).
 * Order: login, input checks, a repeat of the same `clientRequestId` (returns the first result,
 * not counted), the hourly limit, the post and parent checks, then one `db.batch` for the row and
 * `posts.comment_count + 1`.
 */
export async function addComment(input: unknown, deps: AddCommentDeps): Promise<CommentView> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const user = await requireUser(deps.headers, { env });

  const parsed = parseAddComment(input);
  if (!parsed.ok) {
    const first = Object.values(parsed.fieldErrors)[0]?.[0];
    throw new AppError('VALIDATION', { fieldErrors: parsed.fieldErrors, message: first });
  }
  const { postId, body, parentId, clientRequestId } = parsed.data;

  const db = getDb(env);
  const earlier = await existingComment(db, user.id, clientRequestId);
  if (earlier) return withEmptyReplies(toCommentView(env, earlier, user, user.id));

  await consume(`comment:user:${user.id}`, HOURLY_LIMIT, 3600, 1, { db, now: deps.now });

  const [post] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!post) throw new AppError('NOT_FOUND');

  // A reply names a parent of the same post; a reply's own parent is used instead (one level).
  let storedParent: string | null = null;
  if (parentId !== undefined) {
    const [parent] = await db
      .select({ id: comments.id, postId: comments.postId, parentId: comments.parentId })
      .from(comments)
      .where(eq(comments.id, parentId));
    if (!parent || parent.postId !== postId) throw new AppError('NOT_FOUND');
    storedParent = parent.parentId ?? parent.id;
  }

  const id = newId();
  const createdAt = new Date(deps.now ?? Date.now());
  try {
    await db.batch([
      db.insert(comments).values({
        id,
        postId,
        authorId: user.id,
        parentId: storedParent,
        body,
        clientRequestId,
        createdAt,
      }),
      db
        .update(posts)
        .set({ commentCount: sql`${posts.commentCount} + 1` })
        .where(eq(posts.id, postId)),
    ]);
  } catch (error) {
    // A second call with the same id raced this one and won: return its comment.
    if (isRequestIdClash(error)) {
      const winner = await existingComment(db, user.id, clientRequestId);
      if (winner) return withEmptyReplies(toCommentView(env, winner, user, user.id));
    }
    // The post or the parent was deleted between the check and the insert (foreign key).
    if (hasMessage(error, /FOREIGN KEY constraint failed/)) throw new AppError('NOT_FOUND');
    throw error;
  }

  const saved = await existingComment(db, user.id, clientRequestId);
  if (!saved) throw new Error('comment not found after insert');
  return withEmptyReplies(toCommentView(env, saved, user, post.authorId));
}

/** A new top-level comment has no replies yet; a reply carries no `replies` key. */
function withEmptyReplies(view: CommentView): CommentView {
  return view.parentId === null ? { ...view, replies: [], replyCount: 0 } : view;
}
