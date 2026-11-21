'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PostView } from '../../post';
import { getFeedAction } from '../api/actions';

/** The next page is fetched when the end marker is this close to the screen (px). */
export const PREFETCH_MARGIN = '800px';

/**
 * The feed's posts: the server's first page, then the next ones as the end marker comes within
 * 800px of the screen. A post is never listed twice. A failed load stops further loads and sets
 * `failed`; `retry` loads again.
 */
export function useInfiniteFeed(initialItems: PostView[], initialCursor: string | null) {
  const [items, setItems] = useState(initialItems);
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
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...result.page.items.filter((p) => !seen.has(p.id))];
        });
        setCursor(result.page.nextCursor);
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

  return { items, cursor, failed, loading, sentinel, retry: loadMore };
}
