import { asc } from 'drizzle-orm';
import { keysetAfter, toPage as toKeysetPage, type Cursor } from '../../../shared/db/cursor';
import { comments } from '../../../shared/db/schema';
import { PAGE_SIZE } from '../model/schema';

export { readCursor } from '../../../shared/db/cursor';

/** Comment lists run oldest first, so the cursor asks for rows after (created_at, id). */
export const afterCursor = (cursor: Cursor | null) =>
  keysetAfter(comments.createdAt, comments.id, cursor);

export const oldestFirst = [asc(comments.createdAt), asc(comments.id)] as const;

/** Splits the PAGE_SIZE + 1 rows read into the page and its cursor. */
export const toPage = <T extends { id: string; createdAt: Date }>(rows: T[]) =>
  toKeysetPage(rows, PAGE_SIZE);
