import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LikeBurst } from './DoubleTapLike';

describe('DoubleTapLike', () => {
  it('視差効果を減らす設定のとき動きの要素を出さない', () => {
    expect(renderToStaticMarkup(<LikeBurst reduceMotion />)).toBe('');
  });

  it('動きを減らさない設定のとき ハートの要素を出し 読み上げからは隠す', () => {
    const html = renderToStaticMarkup(<LikeBurst reduceMotion={false} />);
    expect(html).toContain('data-testid="like-burst"');
    expect(html).toContain('aria-hidden="true"');
  });
});
