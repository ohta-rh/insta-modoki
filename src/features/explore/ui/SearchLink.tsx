import { SearchIcon } from '../../../shared/ui/icons';

/** Shaped like a search box, but a link: it opens /explore/search, where the typing happens. */
export function SearchLink() {
  return (
    <div className="px-4 py-3">
      <a
        href="/explore/search"
        className="flex h-11 w-full items-center gap-2 rounded-lg bg-highlight px-4 text-[length:var(--font-size-md)] text-text"
      >
        <SearchIcon size={20} aria-hidden="true" />
        <span>検索</span>
      </a>
    </div>
  );
}
