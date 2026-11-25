import { and, eq, gt, lt, or, type AnyColumn, type SQL } from 'drizzle-orm';
import { AppError } from '../errors';

export type Cursor = { createdAt: Date; id: string };

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** `createdAt|id`, base64url (docs/architecture/conventions.md "カーソル"). */
export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.createdAt.toISOString()}|${cursor.id}`, 'utf8').toString(
    'base64url',
  );
}

export function decodeCursor(value: string): Cursor {
  const invalid = () => new AppError('VALIDATION');
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw invalid();
  const text = Buffer.from(value, 'base64url').toString('utf8');
  const bar = text.indexOf('|');
  if (bar < 0) throw invalid();
  const iso = text.slice(0, bar);
  const id = text.slice(bar + 1);
  const createdAt = new Date(iso);
  if (!ISO.test(iso) || Number.isNaN(createdAt.getTime()) || id === '') throw invalid();
  return { createdAt, id };
}

/** The cursor of a list input: absent, or a string that decodes; anything else is VALIDATION. */
export function readCursor(raw: unknown): Cursor | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw new AppError('VALIDATION');
  return decodeCursor(raw);
}

/** For lists that run oldest first: the rows after (created_at, id). No cursor, no condition. */
export function keysetAfter(
  createdAt: AnyColumn,
  id: AnyColumn,
  cursor: Cursor | null,
): SQL | undefined {
  if (!cursor) return undefined;
  return or(
    gt(createdAt, cursor.createdAt),
    and(eq(createdAt, cursor.createdAt), gt(id, cursor.id)),
  );
}

/** For lists that run newest first: the rows before (created_at, id). No cursor, no condition. */
export function keysetBefore(
  createdAt: AnyColumn,
  id: AnyColumn,
  cursor: Cursor | null,
): SQL | undefined {
  if (!cursor) return undefined;
  return or(
    lt(createdAt, cursor.createdAt),
    and(eq(createdAt, cursor.createdAt), lt(id, cursor.id)),
  );
}

/**
 * Splits the `size + 1` rows read into the page and its cursor (taken from the page's last row;
 * `cursorOf` says which column is the tie-break id when it is not `id`).
 */
export function toPage<T extends { createdAt: Date }>(
  rows: T[],
  size: number,
  cursorOf: (row: T) => Cursor = (row) => ({
    createdAt: row.createdAt,
    id: (row as unknown as { id: string }).id,
  }),
): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, size);
  const last = items[items.length - 1];
  const nextCursor = rows.length > size && last ? encodeCursor(cursorOf(last)) : null;
  return { items, nextCursor };
}
