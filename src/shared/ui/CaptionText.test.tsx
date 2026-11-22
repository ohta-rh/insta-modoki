import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CaptionText } from './CaptionText';

const render = (caption: string) => renderToStaticMarkup(<CaptionText caption={caption} />);

describe('CaptionText', () => {
  it('タグをリンクにし、HTML を文字として出す', () => {
    const html = render('#Tokyo の朝');
    expect(html).toMatch(/<a [^>]*href="\/explore\/tags\/tokyo"[^>]*>#Tokyo<\/a> の朝/);

    const script = render('<script>alert(1)</script>#x');
    expect(script).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(script).not.toContain('<script');
    expect(script).toMatch(/href="\/explore\/tags\/x"/);
  });

  it('日本語のタグは URL エンコードしたリンクにする', () => {
    expect(render('#東京')).toContain(`href="/explore/tags/${encodeURIComponent('東京')}"`);
  });

  it('101 字のタグはリンクにしない', () => {
    const html = render(`#${'a'.repeat(101)}`);
    expect(html).not.toContain('<a');
    expect(html).toContain(`#${'a'.repeat(101)}`);
  });
});
