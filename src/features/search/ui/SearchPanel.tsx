'use client';

import { SearchBox } from './SearchBox';

/**
 * The search panel's content (the side panel of the navigation). The same GET form as the
 * /explore/search page: Enter before any script is a plain `?q=` request, and the candidates
 * appear as you type.
 */
export function SearchPanel() {
  return (
    <form role="search" action="/explore/search" method="get" className="min-h-0 flex-1">
      <SearchBox defaultValue="" variant="panel" />
    </form>
  );
}
