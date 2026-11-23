import type { UserSummary } from '../../post';
import { noMatchMessage } from '../model/limits';

function Avatar({ user }: { user: UserSummary }) {
  return user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt=""
      width={40}
      height={40}
      className="h-10 w-10 shrink-0 rounded-full bg-surface object-cover"
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface font-bold text-text"
    >
      {Array.from(user.username)[0]?.toUpperCase()}
    </span>
  );
}

/** `onSurface`: the row has the surface background, where the secondary text color is under 4.5:1. */
function RowText({ user, onSurface = false }: { user: UserSummary; onSurface?: boolean }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-[length:var(--font-size-sm)] font-bold">
        {user.username}
      </span>
      <span
        className={`block truncate text-[length:var(--font-size-sm)] ${onSurface ? 'text-text' : 'text-text-secondary'}`}
      >
        {user.displayName}
      </span>
    </span>
  );
}

const ROW = 'flex min-h-[var(--tap-min)] items-center gap-3 px-4 py-1';

/**
 * People found by a search. As a list of links (the server-rendered `?q=` page) every row is an
 * `<a href="/<username>">`. As a listbox (the box's candidates) every row is an `option` the
 * combobox points at with `aria-activedescendant`; a pointer picks it through `onPick`.
 */
export function SearchResultList(
  props:
    | { items: UserSummary[]; query: string }
    | {
        items: UserSummary[];
        query: string;
        listbox: { id: string; activeIndex: number; onPick: (username: string) => void };
      },
) {
  const { items, query } = props;
  if (items.length === 0 && 'listbox' in props) {
    return <ul id={props.listbox.id} role="listbox" aria-label="候補" hidden />;
  }
  if (items.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-[length:var(--font-size-sm)] text-text-secondary">
        {noMatchMessage(query)}
      </p>
    );
  }
  if ('listbox' in props) {
    const { id, activeIndex, onPick } = props.listbox;
    return (
      <ul id={id} role="listbox" aria-label="候補">
        {items.map((u, i) => (
          <li
            key={u.username}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === activeIndex}
            onClick={() => onPick(u.username)}
            className={`${ROW} cursor-pointer ${i === activeIndex ? 'bg-surface' : ''}`}
          >
            <Avatar user={u} />
            <RowText user={u} onSurface={i === activeIndex} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul aria-label="検索結果">
      {items.map((u) => (
        <li key={u.username}>
          <a href={`/${u.username}`} className={ROW}>
            <Avatar user={u} />
            <RowText user={u} />
          </a>
        </li>
      ))}
    </ul>
  );
}
