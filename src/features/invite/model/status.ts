export type InviteStatus = 'active' | 'expired' | 'revoked' | 'used_up';

export type InviteLike = {
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
  revokedAt: Date | null;
};

/** The state of an invite at `now`: revoked, then expired (`expires_at <= now`), then used up. */
export function getInviteStatus(invite: InviteLike, now: number): InviteStatus {
  if (invite.revokedAt !== null) return 'revoked';
  if (invite.expiresAt.getTime() <= now) return 'expired';
  if (invite.usedCount >= invite.maxUses) return 'used_up';
  return 'active';
}
