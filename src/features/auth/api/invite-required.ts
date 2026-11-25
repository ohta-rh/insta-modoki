import type { AuthEnv } from './auth-env';

/** Request header the E2E suite sends to turn "invite code required" on for its own requests. */
export const E2E_INVITE_HEADER = 'x-e2e-invite-required';

/**
 * Whether sign-up needs an invite code: `INVITE_REQUIRED` is exactly 'true'. The M1 default (unset)
 * is "not required". In the E2E server alone (E2E_HARNESS=1 and APP_ENV local or test, the same
 * gate as the /e2e-harness route, ADR-0055) the request header above turns it on for that request,
 * so the invite scenarios run beside the sign-ups of every other spec, which need no code.
 */
export function isInviteRequired(env: Pick<AuthEnv, 'INVITE_REQUIRED'>, headers: Headers): boolean {
  if (env.INVITE_REQUIRED === 'true') return true;
  const e2e =
    process.env.E2E_HARNESS === '1' && ['local', 'test'].includes(process.env.APP_ENV ?? '');
  return e2e && headers.get(E2E_INVITE_HEADER) === 'true';
}
