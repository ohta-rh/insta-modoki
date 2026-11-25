import { userRow, withDb } from './db';
import { harness } from './harness';

export type NewComment = {
  postId: string;
  authorUsername: string;
  /** The id of a top-level comment of the same post, for a reply. */
  parentId?: string;
  body: string;
  /** Epoch ms; default: in order, one second apart, starting two hours ago. */
  createdAt?: number;
};

/** Inserts comments and replies (a parent before its replies) through the app; returns their ids. */
export function insertComments(rows: NewComment[]): string[] {
  const authors = new Map<string, string>();
  const idOf = (username: string) => {
    if (!authors.has(username)) {
      const user = userRow(username);
      if (!user) throw new Error(`利用者がいません: ${username}`);
      authors.set(username, user.id as string);
    }
    return authors.get(username)!;
  };
  const base = Date.now() - 2 * 60 * 60 * 1000;
  const ids = rows.map(() => crypto.randomUUID());
  for (let from = 0; from < rows.length; from += 100) {
    harness({
      op: 'insertComments',
      comments: rows.slice(from, from + 100).map((r, i) => ({
        id: ids[from + i],
        postId: r.postId,
        authorId: idOf(r.authorUsername),
        parentId: r.parentId ?? null,
        body: r.body,
        createdAt: r.createdAt ?? base + (from + i) * 1000,
      })),
    });
  }
  return ids;
}

export function commentRows(postId: string): Record<string, unknown>[] {
  return withDb((db) =>
    db.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at, id').all(postId),
  );
}

export function postCommentCount(postId: string): number {
  return withDb(
    (db) =>
      (db.prepare('SELECT comment_count AS n FROM posts WHERE id = ?').get(postId) as { n: number })
        .n,
  );
}
