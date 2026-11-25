import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { newId } from '../../../shared/db/id';
import { getDb } from '../../../shared/db/client';
import { users } from '../../../shared/db/schema/users';
import { accounts, sessions, verifications } from '../db/schema';
import { hashPassword, verifyPassword } from '../model/password';
import type { AuthEnv } from './auth-env';
import { SESSION_MAX_AGE_SEC } from './session';

/**
 * Better Auth for one request (ADR-0020). It imports no OpenNext code, so scripts and tests can
 * call it with a plain env. Other slices never use it directly: they call getSessionUser/requireUser.
 */
export function createAuth(env: AuthEnv) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(env), {
      provider: 'sqlite',
      schema: { users, sessions, accounts, verifications },
    }),
    user: {
      modelName: 'users',
      fields: { name: 'displayName', image: 'avatarKey' },
      additionalFields: { username: { type: 'string', required: true, input: false } },
    },
    session: { modelName: 'sessions', expiresIn: SESSION_MAX_AGE_SEC },
    account: { modelName: 'accounts' },
    verification: { modelName: 'verifications' },
    emailAndPassword: {
      enabled: true,
      password: {
        hash: (password) => hashPassword(password, env.AUTH_PEPPER),
        verify: ({ hash, password }) => verifyPassword(password, hash, env.AUTH_PEPPER),
      },
    },
    // The built-in limiter is per-isolate memory and useless on Workers; consume() replaces it.
    rateLimit: { enabled: false },
    advanced: { database: { generateId: () => newId() } },
  });
}
