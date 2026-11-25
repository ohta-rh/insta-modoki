import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PostTile } from '../../post';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) => (
    <a href={href} {...rest}>
      {children as never}
    </a>
  ),
}));
vi.mock('../api/actions', () => ({ listExplorePostsAction: vi.fn() }));

import { ExplorePage } from './ExplorePage';

const tile = (id: string): PostTile => ({
  id,
  username: 'haru',
  mediaCount: 2,
  cover: {
    type: 'image',
    width: 1200,
    height: 800,
    altText: '',
    thumbhash: 'YJqGPQw7sFlslqhFafSE+Q6oJ1h2iHB2Rw==',
    srcset: { w320: '/a/w320', w640: '/a/w640', w1080: '/a/w1080' },
  } as PostTile['cover'],
});

describe('ExplorePage', () => {
  it('0 件のとき文言を出す', () => {
    const html = renderToStaticMarkup(<ExplorePage initialItems={[]} initialCursor={null} />);
    expect(html).toContain('まだ人気の投稿がありません');
    expect(html).toContain('href="/explore/search"');
    expect(html).toContain('ユーザーを検索');
  });

  it('見出しと検索のリンクの下にグリッドを出す', () => {
    const html = renderToStaticMarkup(
      <ExplorePage initialItems={[tile('p1'), tile('p2')]} initialCursor="c" />,
    );
    expect(html).toContain('<h1 class="sr-only">発見</h1>');
    expect(html).not.toContain('まだ人気の投稿がありません');
    expect(html.indexOf('ユーザーを検索')).toBeLessThan(html.indexOf('data-testid="post-grid"'));
    expect(html).toContain('href="/p/p1"');
    expect(html).toContain('href="/p/p2"');
    expect(html).toContain('さらに表示');
  });
});
