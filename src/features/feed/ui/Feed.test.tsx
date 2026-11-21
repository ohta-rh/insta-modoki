import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PostView } from '../../post';
import { Feed } from './Feed';
import { renderFeedCards } from './feed-cards';

const NOW = Date.UTC(2026, 10, 21);
const media = (n: number, altText = '') => ({
  type: 'image' as const,
  width: 1200,
  height: 800,
  altText,
  thumbhash: 'YJqGPQw7sFlslqhFafSE+Q6oJ1h2iHB2Rw==',
  srcset: { w320: `/m/${n}/w320.webp`, w640: `/m/${n}/w640.webp`, w1080: `/m/${n}/w1080.webp` },
});
const post = (id: string, photos: number, over: Partial<PostView> = {}): PostView => ({
  id,
  author: { username: 'haru', displayName: 'Haru', avatarUrl: null },
  caption: `キャプション ${id}`,
  media: Array.from({ length: photos }, (_, i) => media(i, i === 0 ? '猫' : '')),
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  createdAt: new Date(NOW - 3_600_000).toISOString(),
  ...over,
});

/** The tags of the photos (the avatar has no srcset). */
const photoTags = (html: string) => html.match(/<img [^>]*srcSet="[^>]*>/g) ?? [];

const feed = (items: PostView[], cursor: string | null = null) =>
  renderToStaticMarkup(
    <Feed
      initialCards={renderFeedCards(items, { now: NOW, firstPriority: true })}
      initialCursor={cursor}
    />,
  );

describe('Feed', () => {
  it('1 枚目だけ eager でほかは lazy で、width と height を持つ', () => {
    const html = feed([post('a', 3), post('b', 1), post('c', 2)]);
    const tags = photoTags(html);
    expect(tags).toHaveLength(6);
    expect(tags[0]).toContain('loading="eager"');
    for (const tag of tags.slice(1)) expect(tag).toContain('loading="lazy"');
    for (const tag of tags) {
      expect(tag).toMatch(/width="1200"/);
      expect(tag).toMatch(/height="800"/);
      expect(tag).toMatch(/background-image:url\(/);
    }
  });

  it('次のページのカードは先頭でも eager にしない', () => {
    const html = renderToStaticMarkup(
      <>{renderFeedCards([post('a', 1)], { now: NOW, firstPriority: false }).map((c) => c.node)}</>,
    );
    expect(photoTags(html)[0]).toContain('loading="lazy"');
  });

  it('各投稿は article で、alt は alt_text（空なら説明の代わりの文）を持つ', () => {
    const html = feed([post('a', 1), post('b', 1)]);
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(photoTags(html)[0]).toContain('alt="猫"');
  });

  it('コメントがあるとき「コメント N 件をすべて見る」が /p/<id> へのリンクになる', () => {
    const html = feed([post('a', 1, { commentCount: 5 }), post('b', 1)]);
    expect(html).toMatch(/<a [^>]*href="\/p\/a"[^>]*>コメント 5 件をすべて見る<\/a>/);
    // Only the post with comments has the link (the icon link of every card is separate).
    expect(html.match(/をすべて見る/g)).toHaveLength(1);
  });

  it('投稿が 0 件のとき空の案内を出す', () => {
    const html = feed([]);
    expect(html).toContain('フォローすると、その人の投稿がここに表示されます');
    expect(html).not.toContain('ここまでです');
  });

  it('続きが無いとき「ここまでです」を出し、続きがあるときは見張りを出す', () => {
    const last = feed([post('a', 1)]);
    expect(last).toContain('ここまでです');
    expect(last).not.toContain('data-testid="feed-sentinel"');
    const more = feed([post('a', 1)], 'abc');
    expect(more).not.toContain('ここまでです');
    expect(more).toContain('data-testid="feed-sentinel"');
  });
});
