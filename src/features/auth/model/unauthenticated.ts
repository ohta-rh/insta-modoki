import { AppError } from '../../../shared/errors';

/** True only for the "not signed in" error, so a page redirects for that and rethrows anything else. */
export const isUnauthenticated = (error: unknown): boolean =>
  error instanceof AppError && error.code === 'UNAUTHENTICATED';
