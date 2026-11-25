'use client';

import type { FeedCard } from './feed-cards';
import { useInfiniteFeed } from './useInfiniteFeed';

/**
 * The home feed. The first page is rendered by the server and works without JavaScript; while more
 * exist, a marker under the last post loads the next page as it nears the screen. A failed load
 * keeps the posts and offers a retry. At the end it says so.
 */
export function Feed({
  initialCards,
  initialCursor,
}: {
  /** The first page, rendered by the server (`renderFeedCards`). */
  initialCards: FeedCard[];
  initialCursor: string | null;
}) {
  const { cards, cursor, failed, loading, sentinel, retry } = useInfiniteFeed(
    initialCards,
    initialCursor,
  );

  if (cards.length === 0) {
    return (
      <p className="px-4 py-16 text-center text-text-secondary">
        フォローすると、その人の投稿がここに表示されます
      </p>
    );
  }
  return (
    <section aria-label="フィード" className="mx-auto w-full max-w-[var(--feed-width)]">
      <div className="flex flex-col gap-[var(--feed-item-gap)]">
        {cards.map((card) => (
          <div key={card.id}>{card.node}</div>
        ))}
      </div>
      {cursor !== null && !failed && (
        <div ref={sentinel} data-testid="feed-sentinel" aria-hidden="true" className="h-10" />
      )}
      <div role="status" className="sr-only">
        {loading ? '読み込み中' : ''}
      </div>
      {failed && (
        <div role="alert" className="px-4 py-6 text-center text-[length:var(--font-size-sm)]">
          <p>通信に失敗しました</p>
          <button
            type="button"
            onClick={() => void retry()}
            className="mt-2 min-h-[var(--tap-min)] rounded-lg border border-border px-4 font-bold hover:bg-surface"
          >
            もう一度読み込む
          </button>
        </div>
      )}
      {cursor === null && (
        <p className="px-4 py-8 text-center text-[length:var(--font-size-sm)] text-text-secondary">
          ここまでです
        </p>
      )}
    </section>
  );
}
