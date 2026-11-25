// The auth slice's public entry. Other slices import only from here; the auth library stays hidden.
export { getSessionUser, requireUser, type SessionUser } from './api/session-user';
export { isProtectedPath } from './model/protected-paths';
export { isValidUsernameFormat } from './model/schema';
export { isUnauthenticated } from './model/unauthenticated';
export type { AuthEnv } from './api/auth-env';
export { isInviteRequired } from './api/invite-required';
export { requireAdmin } from './api/require-admin';
// For the E2E harness only (ADR-0069): it makes a user with a session without the sign-up screen.
export { newSession, sessionSetCookie } from './api/session';
export { hashPassword } from './model/password';
