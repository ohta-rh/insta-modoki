import { isValidUsernameFormat } from '../../auth';

/**
 * The stored username a `/<username>` path names: lower-cased, or null when it can never be one
 * (wrong shape, reserved, not a string). A null never reaches the database.
 */
export function lookupUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const lower = value.toLowerCase();
  return isValidUsernameFormat(lower) ? lower : null;
}
