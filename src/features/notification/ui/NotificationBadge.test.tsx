import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsAA } from '../../../shared/ui/contrast';
import { NotificationBadgeView } from './NotificationBadge';

describe('NotificationBadge', () => {
  it('0 件では何も描かない', () => {
    expect(renderToStaticMarkup(<NotificationBadgeView count={0} />)).toBe('');
  });

  it('1 から 99 は数字、100 は 99+、読み上げには未読の数を足す', () => {
    const one = renderToStaticMarkup(<NotificationBadgeView count={1} />);
    expect(one).toContain('aria-hidden="true"');
    expect(one).toContain('>1</span>');
    expect(one).toContain('<span class="sr-only">（未読 1 件）</span>');
    const cap = renderToStaticMarkup(<NotificationBadgeView count={100} />);
    expect(cap).toContain('>99+</span>');
    expect(cap).toContain('（未読 99 件以上）');
    expect(one).not.toContain('aria-live');
  });

  it('バッジの文字と背景は AA のコントラストを満たす', () => {
    expect(meetsAA(contrastRatio('#ffffff', '#4f46c8'))).toBe(true);
  });
});
