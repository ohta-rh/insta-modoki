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
