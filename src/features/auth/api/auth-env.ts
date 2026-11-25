import type { DbEnv } from '../../../shared/db/client';

/** The Workers bindings and settings the auth slice reads (.dev.vars locally, secrets in production). */
export type AuthEnv = DbEnv & {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  AUTH_PEPPER: string;
};
