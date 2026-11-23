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

  it('スキップリンク → 上部バー → サイドナビ → main → フッター → 下部ナビの順に描く', () => {
    const html = render();
    const order = [
      'href="#main"',
      'data-shell-top-bar',
      'data-nav="side"',
      '<main id="main"',
      FOOTER_NOTICE,
      'data-nav="bottom"',
    ].map((s) => html.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('現在の項目だけに aria-current="page"（2 つのナビで各 1 つ）', () => {
    const html = render({ currentPath: '/explore' });
    expect(html.match(/aria-current="page"/g)).toHaveLength(2);
  });

  it('検索はサイドナビだけにあり、下部タブは 5 項目', () => {
    const html = render({ currentPath: '/explore/search' });
    expect(html.match(/href="\/explore\/search"/g)).toHaveLength(1);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    const bottomNav = html.slice(html.indexOf('data-nav="bottom"'));
    expect(bottomNav.match(/<a /g)).toHaveLength(5);
    expect(html.slice(html.indexOf('data-nav="side"')).split('data-nav="bottom"')[0]).toContain(
      'href="/explore/search"',
    );
  });

  it('今の項目は塗りつぶしのアイコン、他は輪郭で、項目に線のクラスが無い', () => {
    const html = render();
    const side = html.slice(html.indexOf('data-nav="side"'), html.indexOf('<main'));
    expect(side.match(/data-filled="true"/g)).toHaveLength(1);
    expect(html).not.toMatch(/border-l-2|border-t-2/);
  });

  it('viewer がいるときだけ、その他のボタンとメニューと上部バーを描く', () => {
    const html = render();
    expect(html.match(/popovertarget="more-menu"/gi)).toHaveLength(2);
    expect(html).toContain('id="more-menu"');
    expect(html).toContain('href="/accounts/edit"');
    expect(html).toContain('href="/accounts/logout"');
    expect(html).toContain('data-shell-top-bar');
    const none = render({ viewer: null });
    expect(none.toLowerCase()).not.toContain('popovertarget');
    expect(none).not.toContain('more-menu');
    expect(none).not.toContain('data-shell-top-bar');
    const hidden = render({ hideNav: true });
    expect(hidden).not.toContain('data-shell-top-bar');
    expect(hidden).not.toContain('more-menu');
  });

  it('main は画面が広げられる（data-page-width="wide"）、フッターに印がある', () => {
    const html = render();
    expect(html).toMatch(/<main id="main" class="[^"]*has-\[\[data-page-width=wide\]\]:max-w-none/);
    expect(html).toContain('<footer data-shell-footer');
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
      /<div class="relative[^"]*"><a [^>]*href="\/notifications"[^>]*>(?:(?!<\/a>).)*<span[^>]*>通知<\/span><\/a><span class="pointer-events-none absolute [^"]*"><b>BADGE<\/b><\/span><\/div>/g,
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
