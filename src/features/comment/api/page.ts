import { and, asc, eq, gt, or, type SQL } from 'drizzle-orm';
import { decodeCursor, encodeCursor } from '../../../shared/db/cursor';
import { comments } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { PAGE_SIZE } from '../model/schema';

/** The cursor of a list input: absent, or a string that decodes; anything else is VALIDATION. */
export function readCursor(raw: unknown) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw new AppError('VALIDATION');
  return decodeCursor(raw);
}

/** Comment lists run oldest first, so the cursor asks for rows after (created_at, id). */
export function afterCursor(cursor: ReturnType<typeof readCursor>): SQL | undefined {
  if (!cursor) return undefined;
  return or(
    gt(comments.createdAt, cursor.createdAt),
    and(eq(comments.createdAt, cursor.createdAt), gt(comments.id, cursor.id)),
  );
}

export const oldestFirst = [asc(comments.createdAt), asc(comments.id)] as const;

/** Splits the PAGE_SIZE + 1 rows read into the page and its cursor. */
export function toPage<T extends { id: string; createdAt: Date }>(rows: T[]) {
  const items = rows.slice(0, PAGE_SIZE);
  const last = items[items.length - 1];
  const nextCursor =
    rows.length > PAGE_SIZE && last
      ? encodeCursor({ createdAt: last.createdAt, id: last.id })
      : null;
  return { items, nextCursor };
}
