import { describe, expect, it } from 'vitest';
import { notificationLinkLabel } from './NotificationNavLink';

describe('NotificationNavLink', () => {
  it('リンクの名前は 0 件で付けず、未読があれば「通知（未読 N 件）」にする', () => {
    expect(notificationLinkLabel(0)).toBeUndefined();
    expect(notificationLinkLabel(3)).toBe('通知（未読 3 件）');
    expect(notificationLinkLabel(100)).toBe('通知（未読 99 件以上）');
  });
});
