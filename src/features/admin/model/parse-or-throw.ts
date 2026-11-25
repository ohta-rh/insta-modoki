import { AppError } from '../../../shared/errors';
import type { ParseResult } from './schema';

/**
 * The parsed input. A target that is missing, empty or malformed is NOT_FOUND (the delete
 * operations name an existing thing or nothing); any other bad input is VALIDATION.
 */
export function dataOrThrow<T>(parsed: ParseResult<T>, targetField: string | null): T {
  if (parsed.ok) return parsed.data;
  if (targetField !== null && parsed.fieldErrors[targetField]) throw new AppError('NOT_FOUND');
  throw new AppError('VALIDATION', { fieldErrors: parsed.fieldErrors });
}
