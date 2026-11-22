import type { DbEnv } from '../../../shared/db/client';

/** The Workers bindings and settings the auth slice reads (.dev.vars locally, secrets in production). */
export type AuthEnv = DbEnv & {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  AUTH_PEPPER: string;
  /** 'true' makes an invite code required to sign up; unset or anything else leaves it optional (M1). */
  INVITE_REQUIRED?: string;
};
