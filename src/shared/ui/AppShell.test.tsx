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

  it('badges を渡したときだけその項目に差し込む', () => {
    const none = render();
    expect(none).not.toContain('BADGE');
    // No badge: the item is the bare <a>, no wrapper.
    expect(none).not.toContain('pointer-events-none');
    const html = render({ badges: { notifications: <b>BADGE</b> } });
    expect(html.match(/BADGE/g)).toHaveLength(2);
    // Only the 通知 item gets a wrapper; the others stay a bare <a> directly in the nav.
    expect(html.match(/pointer-events-none/g)).toHaveLength(2);
  });

  it('badges はリンクの外、同じ項目の囲みの中に差し込む', () => {
    const html = render({ badges: { notifications: <b>BADGE</b> } });
    // Each navigation: <div class="relative ..."><a ...>…<span>通知</span></a><span class="pointer-events-none absolute ..."><b>BADGE</b></span></div>
    const wrapped = html.match(
      /<div class="relative[^"]*"><a [^>]*href="\/notifications"[^>]*>(?:(?!<\/a>).)*<span>通知<\/span><\/a><span class="pointer-events-none absolute [^"]*"><b>BADGE<\/b><\/span><\/div>/g,
    );
    expect(wrapped).toHaveLength(2);
    // Nothing of the badge inside any link.
    for (const a of html.match(/<a [^>]*>.*?<\/a>/g) ?? []) expect(a).not.toContain('BADGE');
  });

  it('linkAs を渡したときだけその項目の <a> を差し替える', () => {
    const Marked = (props: React.ComponentProps<'a'>) => <a {...props} data-marked="1" />;
    expect(render()).not.toContain('data-marked');
    const html = render({ linkAs: { notifications: Marked } });
    expect(html.match(/data-marked="1"/g)).toHaveLength(2);
  });
});
