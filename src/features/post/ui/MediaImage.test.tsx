import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MediaView } from '../model/schema';
import { MediaImage } from './MediaImage';

const media = (thumbhash: string): MediaView => ({
  type: 'image',
  width: 640,
  height: 480,
  altText: '写真',
  thumbhash,
  srcset: { w320: '/a-320', w640: '/a-640', w1080: '/a-1080' },
});
const VALID = 'YJqGPQw7sFlslqhFafSE+Q6oJ1h2iHB2Rw==';
const html = (m: MediaView, priority: boolean) =>
  renderToStaticMarkup(<MediaImage media={m} alt="写真" priority={priority} />);

describe('MediaImage の背景', () => {
  it('優先読み込みの写真はぼかしの PNG を背景にする', () => {
    const out = html(media(VALID), true);
    expect(out).toContain('background-image:url(&quot;data:image/png;base64,');
    expect(out).not.toContain('background-color');
  });

  it('優先読み込みでない写真は平均の色だけを背景にする', () => {
    const out = html(media(VALID), false);
    expect(out).not.toContain('data:');
    expect(out).not.toContain('background-image');
    expect(out).toMatch(/background-color:rgb\(\d+ \d+ \d+\)/);
  });

  it('ThumbHash が壊れているときは、背景の指定が無い', () => {
    for (const p of [true, false]) {
      const out = html(media('!!!'), p);
      expect(out).not.toContain('background-image');
      expect(out).not.toContain('background-color');
    }
  });
});
