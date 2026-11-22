'use client';

import Link from 'next/link';
import type { StoryTrayView } from '../api/list-story-tray';
import { saveStoryQueue } from '../model/story-queue';
import { AddStoryButton } from './AddStoryButton';
import { StoryRing } from './StoryRing';

const ITEM =
  'group relative flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] w-[72px] shrink-0 flex-col items-center gap-1 text-center';

/**
 * The tray above the feed: the add button, the viewer's own story when there is one, then the
 * people they follow (unseen first). Opening one first saves the order, so the viewer can walk on
 * to the next person. `view` is null when the tray could not be read: only the add button shows.
 */
export function StoryTray({ view }: { view: StoryTrayView | null }) {
  const queue = view?.items.map((i) => i.user.username) ?? [];
  return (
    <nav aria-label="ストーリー" className="mb-4">
      <ul
        role="list"
        data-testid="story-tray"
        className="m-0 flex h-24 w-0 min-w-full list-none gap-3 overflow-x-auto overflow-y-hidden p-0"
      >
        <li className="shrink-0">
          <AddStoryButton me={view?.me ?? null} />
        </li>
        {view?.hasOwn ? (
          <li className="shrink-0">
            <Link
              href={`/stories/${view.me.username}`}
              prefetch={false}
              scroll={false}
              className={ITEM}
            >
              <span className="sr-only">あなたのストーリー</span>
              <StoryRing user={view.me} unseen />
              <span aria-hidden="true" className="w-full truncate text-xs text-text-secondary">
                あなた
              </span>
            </Link>
          </li>
        ) : null}
        {view?.items.map((item) => (
          <li key={item.user.username} className="shrink-0">
            <Link
              href={`/stories/${item.user.username}`}
              prefetch={false}
              scroll={false}
              className={ITEM}
              onClick={() => saveStoryQueue(queue)}
            >
              <span className="sr-only">
                {`${item.user.username}のストーリー（${item.hasUnseen ? '未視聴' : '視聴済み'}）`}
              </span>
              <StoryRing user={item.user} unseen={item.hasUnseen} />
              <span aria-hidden="true" className="w-full truncate text-xs text-text-secondary">
                {item.user.username}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
