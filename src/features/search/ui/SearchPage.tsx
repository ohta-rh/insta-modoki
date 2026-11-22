import type { UserSummary } from '../../post';
import { SearchBox } from './SearchBox';
import { SearchResultList } from './SearchResultList';

/**
 * The /explore/search screen. The form is a plain GET, so Enter works before any script loads and
 * the result below is drawn on the server; once hydrated the box lists candidates as you type.
 */
export function SearchPage({
  q = '',
  items,
  error,
}: {
  q?: string;
  /** The server's result for `q`; absent when nothing was searched. */
  items?: UserSummary[];
  /** The message of a refused search (VALIDATION, RATE_LIMITED). */
  error?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[var(--content-max)]">
      <h1 className="sr-only">検索</h1>
      <form role="search" action="/explore/search" method="get">
        <SearchBox defaultValue={q} />
      </form>
      {error !== undefined && (
        <p role="alert" className="px-4 py-2 text-[length:var(--font-size-sm)] text-red-700">
          {error}
        </p>
      )}
      {items !== undefined && <SearchResultList items={items} query={q} />}
    </div>
  );
}
