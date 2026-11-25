import { decodeCursor, type Cursor } from '../../../shared/db/cursor';
import { AppError } from '../../../shared/errors';

/** Posts the home feed shows per request (docs/architecture/routes.md `getFeed`). */
export const FEED_PAGE_SIZE = 12;

export type Page<T> = { items: T[]; nextCursor: string | null };

/**
 * `getFeed`'s input: only an optional cursor. There is no field naming a user: the feed is always
 * the signed-in user's. A cursor that is not a string or does not decode is VALIDATION.
 */
export function parseGetFeedInput(input: unknown): { cursor: Cursor | null } {
  const raw = (input ?? {}) as { cursor?: unknown };
  if (typeof input !== 'object' && input !== undefined && input !== null) {
    throw new AppError('VALIDATION');
  }
  if (raw.cursor === undefined || raw.cursor === null) return { cursor: null };
  if (typeof raw.cursor !== 'string') throw new AppError('VALIDATION');
  return { cursor: decodeCursor(raw.cursor) };
}
