import type { invites } from '../../../shared/db/schema';
import { getInviteStatus, type InviteStatus } from './status';

export type InviteView = {
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  status: InviteStatus;
};

export function toInviteView(row: typeof invites.$inferSelect, now: number): InviteView {
  return {
    code: row.code,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    status: getInviteStatus(row, now),
  };
}
