'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { ErrorBody } from '../../../shared/errors';
import { CarouselIcon } from '../../../shared/ui/icons';
import { photoAlt } from '../model/alt-text';
import type { Page, PostTile } from '../model/schema';
import { thumbhashDataUrl } from '../model/thumbhash';

/** The first six tiles are on the first screen; the rest load lazily. */
const EAGER_TILES = 6;
const SIZES = '(min-width: 768px) 311px, 33vw';

/** One tile: a 3:4 photo that links to the post. `scroll={false}` keeps the page where it is (the profile opens the post in a modal). */
export function PostTileItem({
  post,
  eager,
  scroll,
}: {
  post: PostTile;
  eager: boolean;
  scroll?: boolean;
}) {
  const { cover } = post;
  const placeholder = thumbhashDataUrl(cover.thumbhash);
  return (
    <Link
      href={`/p/${post.id}`}
      prefetch={false}
      scroll={scroll}
      className="relative block aspect-[3/4] overflow-hidden bg-highlight"
    >
      <img
        src={cover.srcset.w320}
        srcSet={`${cover.srcset.w320} 320w, ${cover.srcset.w640} 640w`}
        sizes={SIZES}
        width={cover.width}
        height={cover.height}
        alt={photoAlt({
          altText: cover.altText,
          username: post.username,
          position: 1,
          count: post.mediaCount,
        })}
        loading={eager ? undefined : 'lazy'}
        decoding="async"
        className="block h-full w-full bg-cover object-cover"
        style={{
          aspectRatio: '3 / 4',
          backgroundImage: placeholder ? `url("${placeholder}")` : undefined,
        }}
      />
      {post.mediaCount > 1 && (
        <span
          role="img"
          aria-label={`${post.mediaCount} 枚の写真`}
          className="absolute top-2 right-2 flex h-5 w-5 text-white drop-shadow"
        >
          <CarouselIcon size={20} filled />
        </span>
      )}
    </Link>
  );
}

/** `incoming` after `previous`, without any post `previous` already has. */
export function mergeTiles(previous: PostTile[], incoming: PostTile[]): PostTile[] {
  const seen = new Set(previous.map((p) => p.id));
  return [...previous, ...incoming.filter((p) => !seen.has(p.id))];
}

/** What the grid shows; `PostTileGrid` holds the state. */
export function PostTileGridView({
  label,
  items,
  hasMore,
  failed,
  emptyText,
  onMore,
  sentinel,
}: {
  label: string;
  items: PostTile[];
  hasMore: boolean;
  failed: boolean;
  emptyText: string;
  onMore: () => void;
  sentinel: RefObject<HTMLDivElement | null>;
}) {
  return (
    <section aria-label={label}>
      {items.length === 0 ? (
        <p className="px-4 py-16 text-center text-text-secondary">{emptyText}</p>
      ) : (
        <div data-testid="post-grid" className="grid grid-cols-3 gap-px">
          {items.map((post, i) => (
            <PostTileItem key={post.id} post={post} eager={i < EAGER_TILES} />
          ))}
        </div>
      )}
      {hasMore && !failed && (
        <>
          <div ref={sentinel} data-testid="grid-sentinel" aria-hidden="true" className="h-10" />
          <div className="flex justify-center py-4">
            <button
              type="button"
              onClick={onMore}
              className="min-h-[var(--tap-min)] rounded-lg border border-border px-4 font-bold hover:bg-surface"
            >
              さらに表示
            </button>
          </div>
        </>
      )}
      {failed && (
        <div role="alert" className="px-4 py-6 text-center text-[length:var(--font-size-sm)]">
          <p>読み込めませんでした</p>
          <button
            type="button"
            onClick={onMore}
            className="mt-2 min-h-[var(--tap-min)] rounded-lg border border-border px-4 font-bold hover:bg-surface"
          >
            もう一度読み込む
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * A 3-column grid of post tiles (the tag page; the discover and saved grids use it too). The
 * first page comes from the server and works without JavaScript; while more exist, a marker
 * below the last row loads the next page as it scrolls into view and a "さらに表示" button does
 * the same for the keyboard. A failed load says so and offers a retry.
 */
export function PostTileGrid({
  label,
  initialItems,
  initialCursor,
  load,
  emptyText,
  hiddenIds,
}: {
  label: string;
  initialItems: PostTile[];
  initialCursor: string | null;
  load: (
    cursor: string,
  ) => Promise<{ ok: true; page: Page<PostTile> } | { ok: false; error: ErrorBody }>;
  emptyText: string;
  /** Posts to leave out (deleted since the page was read). Left out: every post is drawn. */
  hiddenIds?: ReadonlySet<string>;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (busy.current || cursor === null) return;
    busy.current = true;
    setFailed(false);
    try {
      const result = await load(cursor);
      if (result.ok) {
        setItems((prev) => mergeTiles(prev, result.page.items));
        setCursor(result.page.nextCursor);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  }, [cursor, load]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || failed || cursor === null) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, failed, cursor]);

  return (
    <PostTileGridView
      label={label}
      items={hiddenIds ? items.filter((p) => !hiddenIds.has(p.id)) : items}
      hasMore={cursor !== null}
      failed={failed}
      emptyText={emptyText}
      onMore={() => void loadMore()}
      sentinel={sentinel}
    />
  );
}
