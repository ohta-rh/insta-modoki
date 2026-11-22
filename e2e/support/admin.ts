import { randomInt } from 'node:crypto';
import { harness } from './harness';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** A code no earlier run has used, in the shape the app issues (10 of A-Z and 0-9). */
export function newInviteCode(): string {
  return Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

/** Makes an existing user an administrator (`users.role = 'admin'`), through the app's harness. */
export function makeAdmin(username: string): void {
  harness({ op: 'makeAdmin', username });
}

export type SeedInvite = {
  maxUses?: number;
  usedCount?: number;
  /** Milliseconds since the epoch; a day from now by default. */
  expiresAt?: number;
  revokedAt?: number;
};

/** Writes an invite row (owned by a seeded administrator) and returns its code. */
export function seedInvite(options: SeedInvite = {}): string {
  const code = newInviteCode();
  harness({
    op: 'seedInvite',
    code,
    maxUses: options.maxUses ?? 5,
    expiresAt: options.expiresAt ?? Date.now() + 86_400_000,
    ...(options.usedCount === undefined ? {} : { usedCount: options.usedCount }),
    ...(options.revokedAt === undefined ? {} : { revokedAt: options.revokedAt }),
  });
  return code;
}

/**
 * Request headers that make the E2E server treat sign-up as invite-only for these requests
 * (ADR-0055), plus a private-range IP of its own so the sign-up rate limit counters stay apart.
 */
export function inviteOnlyHeaders(): Record<string, string> {
  return {
    'x-e2e-invite-required': 'true',
    'cf-connecting-ip': `10.${randomInt(256)}.${randomInt(256)}.${1 + randomInt(254)}`,
  };
}
