import { describe, expect, it } from 'vitest';
import { buildOgMeta, requestOrigin } from './og';
import type { PostView } from './schema';

const post = (
  over: Partial<PostView> = {},
  firstMedia: Partial<PostView['media'][0]> = {},
): PostView => ({
  id: '0199aaaa-bbbb-7ccc-8ddd-eeeeffff0000',
  author: { username: 'alice', displayName: 'Alice', avatarUrl: null },
  caption: '',
  media: [
    {
      type: 'image',
      width: 1600,
      height: 900,
      altText: '',
      thumbhash: 'x',
      srcset: {
        w320: 'http://localhost:3910/b/k/w320.webp',
        w640: 'http://localhost:3910/b/k/w640.webp',
        w1080: 'http://localhost:3910/b/k/w1080.webp',
      },
      ...firstMedia,
    },
    {
      type: 'image',
      width: 10,
      height: 10,
      altText: '',
      thumbhash: 'y',
      srcset: { w320: 'a', w640: 'b', w1080: 'c' },
    },
  ],
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  createdAt: '2026-11-21T00:00:00.000Z',
  ...over,
});

describe('buildOgMeta', () => {
  it('キャプションの先頭 160 字と 1 枚目の画像を OGP に入れ 特殊文字をそのまま扱う', () => {
    const caption = `"引用" <script>alert(1)</script> & ${'あ'.repeat(200)}`;
    const meta = buildOgMeta(post({ caption }), 'https://app.example');
    expect(meta.title).toBe('@alice の投稿');
    expect(Array.from(meta.description)).toHaveLength(160);
    expect(meta.description.startsWith('"引用" <script>alert(1)</script> & ')).toBe(true);
    expect(meta.image).toEqual({
      url: 'http://localhost:3910/b/k/w1080.webp',
      width: 1080,
      height: 608,
    });
    expect(meta.url).toBe('https://app.example/p/0199aaaa-bbbb-7ccc-8ddd-eeeeffff0000');
    expect(meta.twitterCard).toBe('summary_large_image');
  });

  it('キャプションが空のとき 写真の枚数を説明にする', () => {
    expect(buildOgMeta(post(), 'https://app.example').description).toBe('@alice の写真 2 枚');
    expect(buildOgMeta(post({ caption: ' \n ' }), 'https://app.example').description).toBe(
      '@alice の写真 2 枚',
    );
  });

  it('絵文字を 1 字として数え 途中で切らない', () => {
    const meta = buildOgMeta(post({ caption: '😀'.repeat(170) }), 'https://app.example');
    expect(Array.from(meta.description)).toHaveLength(160);
    expect(meta.description).toBe('😀'.repeat(160));
  });

  it('1080px より小さい写真は元の大きさを画像の幅と高さにし 相対の URL は絶対にする', () => {
    const meta = buildOgMeta(
      post(
        {},
        { width: 600, height: 800, srcset: { w320: 'a', w640: 'b', w1080: '/m/w1080.webp' } },
      ),
      'https://app.example',
    );
    expect(meta.image).toEqual({
      url: 'https://app.example/m/w1080.webp',
      width: 600,
      height: 800,
    });
  });
});

describe('requestOrigin', () => {
  const headers = (init: Record<string, string>) => new Headers(init);

  it('host と x-forwarded-proto から origin を作る', () => {
    expect(requestOrigin(headers({ host: 'mado.example', 'x-forwarded-proto': 'https' }))).toBe(
      'https://mado.example',
    );
  });

  it('プロトコルが無いとき localhost は http それ以外は https にする', () => {
    expect(requestOrigin(headers({ host: 'localhost:3102' }))).toBe('http://localhost:3102');
    expect(requestOrigin(headers({ host: 'mado.example' }))).toBe('https://mado.example');
  });

  it('host が無いか壊れているとき http://localhost にする', () => {
    expect(requestOrigin(headers({}))).toBe('http://localhost');
    expect(requestOrigin(headers({ host: 'a b/c' }))).toBe('http://localhost');
    expect(requestOrigin(headers({ host: 'x', 'x-forwarded-proto': 'javascript' }))).toBe(
      'https://x',
    );
  });
});
