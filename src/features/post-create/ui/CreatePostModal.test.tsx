import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CreateNavLink } from './CreateNavLink';
import { needsDiscardCheck } from './CreatePostModal';

describe('needsDiscardCheck', () => {
  it('写真が 0 枚のときは確かめずに閉じる', () => {
    expect(needsDiscardCheck(0)).toBe(false);
  });

  it('写真を 1 枚でも選んだら破棄を確かめる', () => {
    expect(needsDiscardCheck(1)).toBe(true);
    expect(needsDiscardCheck(10)).toBe(true);
  });
});

describe('CreateNavLink', () => {
  it('スクリプトの前は /create への通常のリンクとして描く', () => {
    const html = renderToStaticMarkup(
      <CreateNavLink href="/create" className="shell-item" aria-current="page">
        投稿
      </CreateNavLink>,
    );
    expect(html).toContain('<a ');
    expect(html).toContain('href="/create"');
    expect(html).toContain('aria-current="page"');
  });
});
