'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getFeedAction } from '../api/actions';
import type { FeedCard } from './feed-cards';

/** The next page is fetched when the end marker is this close to the screen (px). */
export const PREFETCH_MARGIN = '800px';

/**
 * The feed's cards: the server's first page, then the next ones as the end marker comes within
 * 800px of the screen. A post is never listed twice. A failed load stops further loads and sets
 * `failed`; `retry` loads again.
 */
export function useInfiniteFeed(initialCards: FeedCard[], initialCursor: string | null) {
  const [cards, setCards] = useState(initialCards);
  const [cursor, setCursor] = useState(initialCursor);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (busy.current || cursor === null) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const result = await getFeedAction({ cursor });
      if (result.ok) {
        setCards((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...result.cards.filter((c) => !seen.has(c.id))];
        });
        setCursor(result.nextCursor);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || failed || cursor === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, failed, cursor]);

  return { cards, cursor, failed, loading, sentinel, retry: loadMore };
}
