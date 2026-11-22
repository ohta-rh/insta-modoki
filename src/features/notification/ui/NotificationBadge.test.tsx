import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsAA } from '../../../shared/ui/contrast';
import { NotificationBadgeView } from './NotificationBadge';

describe('NotificationBadge', () => {
  it('0 件では何も描かない', () => {
    expect(renderToStaticMarkup(<NotificationBadgeView count={0} />)).toBe('');
  });

  it('1 から 99 は数字、100 は 99+。読み上げの文字は足さない（名前はリンクが持つ）', () => {
    const one = renderToStaticMarkup(<NotificationBadgeView count={1} />);
    expect(one).toContain('aria-hidden="true"');
    expect(one).toContain('>1</span>');
    expect(one).not.toContain('sr-only');
    expect(one).not.toContain('未読');
    const cap = renderToStaticMarkup(<NotificationBadgeView count={100} />);
    expect(cap).toContain('>99+</span>');
    expect(cap).not.toContain('未読');
    expect(one).not.toContain('aria-live');
  });

  it('更新で名前だけが変わり、アニメーションを付けない', () => {
    const one = renderToStaticMarkup(<NotificationBadgeView count={1} />);
    const two = renderToStaticMarkup(<NotificationBadgeView count={2} />);
    // Only the digit differs: the same elements, classes and attributes.
    const shape = (html: string) => html.replace(/>[^<]*</g, '><');
    expect(shape(two)).toBe(shape(one));
    expect(one).toContain('>1</span>');
    expect(two).toContain('>2</span>');
    // No motion in any form (the same markup serves prefers-reduced-motion: reduce), no live region.
    for (const html of [one, two]) {
      expect(html).not.toMatch(
        /animate|transition|duration|motion|keyframes|aria-live|role="status"/,
      );
    }
  });

  it('バッジの文字と背景は AA のコントラストを満たす', () => {
    expect(meetsAA(contrastRatio('#ffffff', '#4f46c8'))).toBe(true);
  });
});
