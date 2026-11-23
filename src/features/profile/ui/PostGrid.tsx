'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PostTileItem } from '../../post/ui';
import { listProfilePostsAction } from '../api/actions';
import type { PostThumb } from '../model/schema';
import { useDeletedPosts } from './ProfilePostsProvider';

/** The first six tiles are on the first screen; the rest load lazily. */
const EAGER_TILES = 6;

/**
 * The 3-column grid of a user's posts. The first page comes from the server and works without
 * JavaScript; when more exist, a marker below the last row loads the next page as it scrolls
 * into view. A failed load says so and offers a retry.
 */
export function PostGrid({
  username,
  initialItems,
  initialCursor,
}: {
  username: string;
  initialItems: PostThumb[];
  initialCursor: string | null;
}) {
  const [loaded, setItems] = useState(initialItems);
  const { ids: deleted } = useDeletedPosts();
  const items = loaded.filter((p) => !deleted.has(p.id));
  const [cursor, setCursor] = useState(initialCursor);
  const [failed, setFailed] = useState(false);
  const loading = useRef(false);
  const marker = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading.current || cursor === null) return;
    loading.current = true;
    setFailed(false);
    try {
      const result = await listProfilePostsAction({ username, cursor });
      if (result.ok) {
        // A post is never listed twice, even if the list moved between two requests.
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
      loading.current = false;
    }
  }, [username, cursor]);

  useEffect(() => {
    const el = marker.current;
    if (!el || failed) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, failed, cursor]);

  return (
    <section aria-label="投稿">
      <div data-testid="post-grid" className="grid grid-cols-3 gap-px">
        {items.map((post, i) => (
          // Next's Link opens the post in the modal (intercepting route) on a plain click, keeps the
          // scroll position, and leaves Ctrl/Cmd/middle clicks and a click before hydration to the
          // browser: they load the normal post page.
          <PostTileItem
            key={post.id}
            post={{ ...post, username }}
            eager={i < EAGER_TILES}
            scroll={false}
          />
        ))}
      </div>
      {cursor !== null && !failed && (
        <div ref={marker} data-testid="grid-sentinel" aria-hidden="true" className="h-10" />
      )}
      {failed && (
        <div role="alert" className="px-4 py-6 text-center text-[length:var(--font-size-sm)]">
          <p>読み込めませんでした</p>
          <button
            type="button"
            onClick={() => void loadMore()}
            className="mt-2 min-h-[var(--tap-min)] rounded-lg border border-border px-4 font-bold hover:bg-surface"
          >
            もう一度読み込む
          </button>
        </div>
      )}
    </section>
  );
}
