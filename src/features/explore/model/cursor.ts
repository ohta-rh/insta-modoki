import { AppError } from '../../../shared/errors';

export type ExploreCursor = { asOf: number; likeCount: number; createdAt: Date; id: string };

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DIGITS = /^\d+$/;

/** `asOf|like_count|created_at|id`, base64url (docs/architecture/conventions.md "カーソル"). */
export function encodeExploreCursor(cursor: ExploreCursor): string {
  return Buffer.from(
    `${cursor.asOf}|${cursor.likeCount}|${cursor.createdAt.toISOString()}|${cursor.id}`,
    'utf8',
  ).toString('base64url');
}

/** A broken value, or an `asOf` later than `now` (a forged window), is VALIDATION. */
export function decodeExploreCursor(value: string, now: number): ExploreCursor {
  const invalid = () => new AppError('VALIDATION');
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw invalid();
  const parts = Buffer.from(value, 'base64url').toString('utf8').split('|');
  if (parts.length !== 4) throw invalid();
  const [asOfText, likeText, iso, id] = parts as [string, string, string, string];
  if (!DIGITS.test(asOfText) || !DIGITS.test(likeText)) throw invalid();
  const asOf = Number(asOfText);
  const likeCount = Number(likeText);
  const createdAt = new Date(iso);
  if (!Number.isSafeInteger(asOf) || !Number.isSafeInteger(likeCount)) throw invalid();
  if (asOf > now) throw invalid();
  if (!ISO.test(iso) || Number.isNaN(createdAt.getTime()) || id === '') throw invalid();
  return { asOf, likeCount, createdAt, id };
}
