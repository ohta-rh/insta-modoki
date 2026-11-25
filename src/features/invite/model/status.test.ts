import { describe, expect, it } from 'vitest';
import { getInviteStatus, type InviteLike } from './status';

const NOW = Date.UTC(2026, 10, 23, 12, 0, 0);
const invite = (over: Partial<InviteLike> = {}): InviteLike => ({
  maxUses: 3,
  usedCount: 0,
  expiresAt: new Date(NOW + 60_000),
  revokedAt: null,
  ...over,
});

describe('getInviteStatus', () => {
  it('期限が now と同じ時刻のとき expired（境界）', () => {
    expect(getInviteStatus(invite({ expiresAt: new Date(NOW) }), NOW)).toBe('expired');
    expect(getInviteStatus(invite({ expiresAt: new Date(NOW + 1) }), NOW)).toBe('active');
    expect(getInviteStatus(invite({ expiresAt: new Date(NOW - 1) }), NOW)).toBe('expired');
  });

  it('使用回数が上限に達したとき used_up で、手前は active', () => {
    expect(getInviteStatus(invite({ usedCount: 3 }), NOW)).toBe('used_up');
    expect(getInviteStatus(invite({ usedCount: 2 }), NOW)).toBe('active');
  });

  it('失効済みは他の状態より優先し、期限切れは使い切りより優先する', () => {
    const all = { revokedAt: new Date(NOW - 5), expiresAt: new Date(NOW - 1), usedCount: 3 };
    expect(getInviteStatus(invite(all), NOW)).toBe('revoked');
    expect(getInviteStatus(invite({ ...all, revokedAt: null }), NOW)).toBe('expired');
    expect(
      getInviteStatus(invite({ ...all, revokedAt: null, expiresAt: new Date(NOW + 1) }), NOW),
    ).toBe('used_up');
  });
});
