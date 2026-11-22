import { charLength, hasControlChars } from '../../../shared/text';
import {
  CONTROL_QUERY_MESSAGE,
  EMPTY_QUERY_MESSAGE,
  LONG_QUERY_MESSAGE,
  MAX_QUERY,
} from './limits';

export type ParsedSearchQuery =
  { ok: true; q: string } | { ok: false; fieldErrors: { q: string[] } };

const failed = (message: string): ParsedSearchQuery => ({
  ok: false,
  fieldErrors: { q: [message] },
});

/** Shape and limits of the search text: a string of 1 to 30 code points once outer spaces are cut, no control characters. */
export function parseSearchQuery(input: unknown): ParsedSearchQuery {
  const q = typeof input === 'string' ? input.trim() : '';
  if (q === '') return failed(EMPTY_QUERY_MESSAGE);
  if (charLength(q) > MAX_QUERY) return failed(LONG_QUERY_MESSAGE);
  if (hasControlChars(q)) return failed(CONTROL_QUERY_MESSAGE);
  return { ok: true, q };
}
