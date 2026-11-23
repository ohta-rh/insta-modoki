import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page, PostTile } from '../model/schema';

// Hooks are replaced by plain stand-ins so the component runs as a function: state is fixed at its
// initial value, the setters are spies, effects run at once.
const setters = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('react', async (orig) => ({
  ...(await orig<typeof import('react')>()),
  useState: (initial: unknown) => [
    initial,
    (value: unknown) => {
      setters.calls.push([initial, value]);
    },
  ],
  useRef: (initial: unknown) => ({ current: initial === null ? {} : initial }),
  useCallback: (fn: unknown) => fn,
  useEffect: (fn: () => void) => {
    fn();
  },
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) => (
    <a href={href} {...rest}>
      {children as never}
    </a>
  ),
}));

import { PostTileGrid, PostTileGridView, PostTileItem, mergeTiles } from './PostTileGrid';

const tile = (id: string, over: Partial<PostTile> = {}): PostTile => ({
  id,
  username: 'haru',
  mediaCount: 1,
  cover: {
    type: 'image',
    width: 1200,
    height: 800,
    altText: '',
    thumbhash: 'YJqGPQw7sFlslqhFafSE+Q6oJ1h2iHB2Rw==',
    srcset: {
      w320: `/m/${id}/w320.webp`,
      w640: `/m/${id}/w640.webp`,
      w1080: `/m/${id}/w1080.webp`,
    },
  },
  ...over,
});
const page = (ids: string[], nextCursor: string | null): Page<PostTile> => ({
  items: ids.map((id) => tile(id)),
  nextCursor,
});

type Load = (
  c: string,
) => Promise<{ ok: true; page: Page<PostTile> } | { ok: false; error: never }>;
const grid = (
  over: {
    items?: PostTile[];
    cursor?: string | null;
    load?: Load;
    hiddenIds?: ReadonlySet<string>;
  } = {},
) =>
  PostTileGrid({
    label: '#tokyo の投稿',
    initialItems: over.items ?? [tile('a')],
    initialCursor: over.cursor === undefined ? 'c1' : over.cursor,
    load: over.load ?? (async () => ({ ok: true, page: page([], null) })),
    emptyText: 'まだ投稿がありません',
    hiddenIds: over.hiddenIds,
  });

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  setters.calls.length = 0;
});

describe('PostTileGrid', () => {
  it('hiddenIds の投稿は描かず、省けば全て描く', () => {
    const items = [tile('a'), tile('b'), tile('c')];
    const all = renderToStaticMarkup(grid({ items }));
    expect(all).toContain('href="/p/a"');
    expect(all).toContain('href="/p/b"');
    expect(all).toContain('href="/p/c"');
    const some = renderToStaticMarkup(grid({ items, hiddenIds: new Set(['b']) }));
    expect(some).toContain('href="/p/a"');
    expect(some).not.toContain('href="/p/b"');
    expect(some).toContain('href="/p/c"');
    // When everything is hidden the empty text shows.
    const none = renderToStaticMarkup(grid({ items, hiddenIds: new Set(['a', 'b', 'c']) }));
    expect(none).toContain('まだ投稿がありません');
  });

  it('さらに表示と交差で続きを読み、失敗すると警告と再試行を出す', async () => {
    // The markup: a named region, a 3-column grid, the keyboard button while more exist.
    const html = renderToStaticMarkup(grid());
    expect(html).toContain('<section aria-label="#tokyo の投稿"');
    expect(html).toContain('grid-cols-3');
    expect(html).toMatch(/<button[^>]*min-h-\[var\(--tap-min\)\][^>]*>さらに表示<\/button>/);
    expect(html).toContain('data-testid="grid-sentinel"');
    const last = renderToStaticMarkup(grid({ cursor: null }));
    expect(last).not.toContain('さらに表示');

    // Crossing the sentinel reads the next page with the cursor; the same post is not added twice.
    let seen: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof seen) {
          seen = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const load = vi.fn(async () => ({ ok: true as const, page: page(['a', 'b'], null) }));
    grid({ load });
    seen!([{ isIntersecting: true }]);
    await vi.waitFor(() => expect(load).toHaveBeenCalledWith('c1'));
    await vi.waitFor(() => expect(setters.calls.some(([, v]) => v === null)).toBe(true));

    // A failure shows the alert and the retry.
    const failed = renderToStaticMarkup(
      <PostTileGridView
        label="x"
        items={[tile('a')]}
        hasMore
        failed
        emptyText="なし"
        onMore={() => {}}
        sentinel={{ current: null }}
      />,
    );
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('読み込めませんでした');
    expect(failed).toContain('もう一度読み込む');
    expect(failed).not.toContain('data-testid="grid-sentinel"');
  });

  it('読み込みが失敗しても落ちず、投稿は残る', async () => {
    let seen: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof seen) {
          seen = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const load = vi.fn(async () => {
      throw new Error('network');
    });
    grid({ load: load as unknown as Load });
    seen!([{ isIntersecting: true }]);
    await vi.waitFor(() => expect(setters.calls.some(([, v]) => v === true)).toBe(true));
  });

  it('各マスは /p/<id> へのリンクで、alt を持ち、複数枚には「N 枚の写真」が付く', () => {
    const html = renderToStaticMarkup(
      grid({
        items: [
          tile('a', { mediaCount: 3 }),
          tile('b', { cover: { ...tile('b').cover, altText: '猫' } }),
        ],
      }),
    );
    expect(html).toMatch(/<a [^>]*href="\/p\/a"/);
    expect(html).toContain('alt="haru が投稿した写真（1 / 3）"');
    expect(html).toContain('aria-label="3 枚の写真"');
    expect(html).toContain('alt="猫"');
    expect(html.match(/<img /g)).toHaveLength(2);
  });

  it('マスは 3:4・隙間 1px で、複数枚の印は右上の白いアイコンだけ（数字なし）', () => {
    const html = renderToStaticMarkup(grid({ items: [tile('a', { mediaCount: 3 }), tile('b')] }));
    expect(html).toContain('gap-px');
    expect(html).not.toContain('gap-[2px]');
    expect(html).toContain('aspect-[3/4]');
    expect(html).toContain('bg-highlight');
    expect(html).toContain('aspect-ratio:3 / 4');
    expect(html).toMatch(
      /<span role="img" aria-label="3 枚の写真" class="[^"]*top-2 right-2[^"]*text-white/,
    );
    expect(html).toContain('data-filled="true"');
    expect(html).not.toMatch(/aria-hidden="true">3</);
  });

  it('PostTileItem は単独で使え、scroll を渡せる', () => {
    const html = renderToStaticMarkup(
      <PostTileItem post={tile('z', { mediaCount: 2 })} eager scroll={false} />,
    );
    expect(html).toContain('href="/p/z"');
    expect(html).toContain('aria-label="2 枚の写真"');
  });

  it('0 件なら emptyText を出す', () => {
    const html = renderToStaticMarkup(grid({ items: [], cursor: null }));
    expect(html).toContain('まだ投稿がありません');
    expect(html).not.toContain('<img');
  });

  it('mergeTiles は既にある投稿を重ねない', () => {
    const merged = mergeTiles([tile('a'), tile('b')], [tile('b'), tile('c')]);
    expect(merged.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});
