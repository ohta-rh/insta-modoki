'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { searchUsersAction } from '../api/actions';
import { MAX_QUERY, noMatchMessage } from '../model/limits';
import {
  createSearchController,
  type SearchController,
  type SearchSnapshot,
} from '../model/search-controller';
import { SearchResultList } from './SearchResultList';

const EMPTY: SearchSnapshot = { text: '', answered: null, items: [], error: null };

/**
 * The search field with its candidates (WAI-ARIA combobox + listbox). Typing asks the server once
 * the typing has paused for 250 ms; before hydration the surrounding `<form method="get">` sends
 * `?q=` instead. Up / down move through the candidates, Enter opens the chosen one's profile (with
 * none chosen it submits the form), Escape closes the list and keeps the text.
 */
export function SearchBox({
  defaultValue = '',
  variant = 'page',
}: {
  defaultValue?: string;
  /** `panel`: inside the navigation's side panel (a 44px field on the highlight grey). */
  variant?: 'page' | 'panel';
}) {
  const router = useRouter();
  const listId = useId();
  const [snap, setSnap] = useState<SearchSnapshot>(EMPTY);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const controller = useRef<SearchController | null>(null);

  useEffect(() => {
    const c = createSearchController({
      search: (q) => searchUsersAction(q),
      onChange: (s) => {
        setSnap(s);
        setActive(-1);
        setOpen(true);
      },
    });
    controller.current = c;
    return () => c.dispose();
  }, []);

  const shown = open && snap.items.length > 0;
  const noMatch = open && snap.error === null && snap.answered !== null && snap.items.length === 0;
  const status = shown
    ? `${snap.items.length} 件の候補`
    : noMatch
      ? noMatchMessage(snap.answered ?? '')
      : '';

  const pick = (username: string) => router.push(`/${username}`);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const n = snap.items.length;
    if (e.key === 'ArrowDown' && n > 0) {
      e.preventDefault();
      if (!shown) {
        setOpen(true);
        setActive(0);
      } else setActive((i) => Math.min(i + 1, n - 1));
    } else if (e.key === 'ArrowUp' && shown) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Escape' && shown) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    } else if (e.key === 'Enter' && shown && active >= 0) {
      e.preventDefault();
      pick(snap.items[active]!.username);
    }
  }

  return (
    <div className="px-4 py-3">
      <input
        name="q"
        type="search"
        role="combobox"
        aria-label="ユーザーを検索"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        maxLength={MAX_QUERY}
        defaultValue={defaultValue}
        placeholder="検索"
        onChange={(e) => controller.current?.input(e.target.value)}
        onKeyDown={onKeyDown}
        className={`w-full rounded-lg px-3 text-[length:var(--font-size-md)] ${
          variant === 'panel' ? 'h-11 bg-highlight' : 'min-h-[var(--tap-min)] bg-surface'
        }`}
      />
      <div hidden={!shown}>
        <SearchResultList
          items={snap.items}
          query={snap.answered ?? ''}
          listbox={{ id: listId, activeIndex: active, onPick: pick }}
        />
      </div>
      {snap.text.trim() === '' && snap.error === null && (
        <p className="py-6 text-center text-[length:var(--font-size-sm)] text-text-secondary">
          ユーザー名で検索
        </p>
      )}
      {noMatch && (
        <p className="py-6 text-center text-[length:var(--font-size-sm)] text-text-secondary">
          {noMatchMessage(snap.answered ?? '')}
        </p>
      )}
      {snap.error !== null && (
        <p role="alert" className="py-2 text-[length:var(--font-size-sm)] text-danger">
          {snap.error}
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
