'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { AdminPage, AdminPostRow, AdminUserRow } from '../model/schema';
import { AdminPostTable } from './AdminPostTable';
import { AdminUserTable } from './AdminUserTable';

type Tab = 'posts' | 'users';
const TABS: { id: Tab; label: string }[] = [
  { id: 'posts', label: '投稿' },
  { id: 'users', label: '利用者' },
];

type Props = { posts: AdminPage<AdminPostRow>; users: AdminPage<AdminUserRow> };

/** The "投稿" / "利用者" tabs (role tablist: arrow keys move between them, Home / End jump). */
export function AdminTabs({ posts, users }: Props) {
  const [active, setActive] = useState<Tab>('posts');
  const base = useId();
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ posts: null, users: null });

  const onKeyDown = (e: KeyboardEvent) => {
    const index = TABS.findIndex((t) => t.id === active);
    const next =
      e.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : e.key === 'ArrowLeft'
          ? (index + TABS.length - 1) % TABS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? TABS.length - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    const id = TABS[next]!.id;
    setActive(id);
    refs.current[id]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="管理の対象" onKeyDown={onKeyDown} className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)}
            className="min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-lg border border-border px-4 text-[length:var(--font-size-sm)] font-bold aria-selected:bg-surface"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel-posts`}
        aria-labelledby={`${base}-tab-posts`}
        hidden={active !== 'posts'}
      >
        <AdminPostTable initialItems={posts.items} initialCursor={posts.nextCursor} />
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel-users`}
        aria-labelledby={`${base}-tab-users`}
        hidden={active !== 'users'}
      >
        <AdminUserTable initialItems={users.items} initialCursor={users.nextCursor} />
      </div>
    </div>
  );
}
