import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';
import { FOOTER_NOTICE } from './brand';

const render = (props: Partial<Parameters<typeof AppShell>[0]> = {}) =>
  renderToStaticMarkup(
    <AppShell currentPath="/" viewer={{ username: 'haru' }} {...props}>
      <p>本文</p>
    </AppShell>,
  );

describe('AppShell', () => {
  it('viewer が haru のとき プロフィール の href が /haru', () => {
    expect(render()).toContain('href="/haru"');
  });

  it('viewer が null のとき プロフィール の href が /accounts/login', () => {
    const html = render({ viewer: null });
    expect(html).not.toContain('href="/haru"');
    expect(html).toContain('href="/accounts/login"');
  });

  it('スキップリンク → サイドナビ → main → フッター → 下部ナビの順に描く', () => {
    const html = render();
    const order = [
      'href="#main"',
      'data-nav="side"',
      '<main id="main"',
      FOOTER_NOTICE,
      'data-nav="bottom"',
    ].map((s) => html.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('現在の項目だけに aria-current="page"（2 つのナビで各 1 つ）', () => {
    const html = render({ currentPath: '/explore/search' });
    expect(html.match(/aria-current="page"/g)).toHaveLength(2);
  });

  it('hideNav のときはナビを描かず、スキップリンクと本文とフッターは残す', () => {
    const html = render({ hideNav: true });
    expect(html).not.toContain('<nav');
    expect(html).toContain('href="#main"');
    expect(html).toContain('本文');
    expect(html).toContain(FOOTER_NOTICE);
  });

  it('ナビは aria-label="メイン"', () => {
    expect(render().match(/<nav[^>]*aria-label="メイン"/g)).toHaveLength(2);
  });
});
