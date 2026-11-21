'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { photoAlt, thumbhashDataUrl } from '../../post';
import { listProfilePostsAction } from '../api/actions';
import type { PostThumb } from '../model/schema';
import { useDeletedPosts } from './ProfilePostsProvider';

/** The first six tiles are on the first screen; the rest load lazily. */
const EAGER_TILES = 6;
const SIZES = '(min-width: 768px) 205px, 33vw';

function StackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="8" y="3" width="13" height="13" rx="3" />
      <path d="M5 7a3 3 0 0 0-2 2.8V17a4 4 0 0 0 4 4h7.2A3 3 0 0 0 17 19H7.5A1.5 1.5 0 0 1 6 17.5z" />
    </svg>
  );
}

function Tile({ post, username, eager }: { post: PostThumb; username: string; eager: boolean }) {
  const { cover } = post;
  const placeholder = thumbhashDataUrl(cover.thumbhash);
  return (
    // Next's Link opens the post in the modal (intercepting route) on a plain click, keeps the
    // scroll position, and leaves Ctrl/Cmd/middle clicks and a click before hydration to the
    // browser: they load the normal post page.
    <Link
      href={`/p/${post.id}`}
      prefetch={false}
      scroll={false}
      className="relative block aspect-square overflow-hidden bg-surface"
    >
      <img
        src={cover.srcset.w320}
        srcSet={`${cover.srcset.w320} 320w, ${cover.srcset.w640} 640w`}
        sizes={SIZES}
        width={cover.width}
        height={cover.height}
        alt={photoAlt({
          altText: cover.altText,
          username,
          position: 1,
          count: post.mediaCount,
        })}
        loading={eager ? undefined : 'lazy'}
        decoding="async"
        className="block h-full w-full bg-cover object-cover"
        style={{
          aspectRatio: '1',
          backgroundImage: placeholder ? `url("${placeholder}")` : undefined,
        }}
      />
      {post.mediaCount > 1 && (
        <span
          role="img"
          aria-label={`${post.mediaCount} 枚の写真`}
          className="absolute top-1 right-1 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[length:var(--font-size-xs)] font-bold text-white"
        >
          <StackIcon />
          <span aria-hidden="true">{post.mediaCount}</span>
        </span>
      )}
    </Link>
  );
}

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
      <div data-testid="post-grid" className="grid grid-cols-3 gap-[2px]">
        {items.map((post, i) => (
          <Tile key={post.id} post={post} username={username} eager={i < EAGER_TILES} />
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
