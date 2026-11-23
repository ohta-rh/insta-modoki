import { SearchIcon } from '../../../shared/ui/icons';

/** Shaped like a search box, but a link: it opens /explore/search, where the typing happens. */
export function SearchLink() {
  return (
    <div className="px-4 py-3">
      <a
        href="/explore/search"
        className="flex min-h-[var(--tap-min)] w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[length:var(--font-size-md)] text-text"
      >
        <SearchIcon size={20} aria-hidden="true" />
        <span>ユーザーを検索</span>
      </a>
    </div>
  );
}
