'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { ProfileTab } from '../model/tab';

const TAB_CLASS =
  'flex min-h-[var(--tap-min)] flex-1 items-center justify-center border-t-2 text-[length:var(--font-size-sm)] font-bold';

/**
 * The profile's tabs: 投稿, and 保存済み for the owner only. Each tab is a link, so it opens
 * without JavaScript; once hydrated, ← / → move the focus to the neighbouring tab (roving
 * tabindex: only the selected tab is in the Tab order). The page body goes in the tabpanel.
 */
export function ProfileTabs({
  username,
  isMe,
  current,
  children,
}: {
  username: string;
  isMe: boolean;
  current: ProfileTab;
  children: ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  const tabs: { id: ProfileTab; label: string; href: string }[] = [
    { id: 'posts', label: '投稿', href: `/${username}` },
    ...(isMe ? [{ id: 'saved' as const, label: '保存済み', href: `/${username}?tab=saved` }] : []),
  ];

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const links = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);
    const at = links.indexOf(document.activeElement as HTMLElement);
    if (at < 0 || links.length < 2) return;
    e.preventDefault();
    const step = e.key === 'ArrowRight' ? 1 : -1;
    links[(at + step + links.length) % links.length]?.focus();
  };

  return (
    <>
      <div
        ref={list}
        role="tablist"
        aria-label="プロフィールの表示"
        onKeyDown={onKeyDown}
        className="flex border-t border-border"
      >
        {tabs.map((tab) => {
          const selected = tab.id === current;
          return (
            <a
              key={tab.id}
              id={`profile-tab-${tab.id}`}
              role="tab"
              href={tab.href}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={`${TAB_CLASS} ${selected ? 'border-text text-text' : 'border-transparent text-text-secondary'}`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>
      <div role="tabpanel" aria-labelledby={`profile-tab-${current}`}>
        {children}
      </div>
    </>
  );
}
