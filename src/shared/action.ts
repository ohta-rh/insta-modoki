import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { AppError, toErrorResponse, type ErrorBody } from './errors';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ErrorBody };

/** Logs the name of an unexpected error (never its message: it may hold SQL or paths). AppError is silent. */
export function logUnexpected(name: string, error: unknown): void {
  if (!(error instanceof AppError)) {
    console.error(`${name} failed`, error instanceof Error ? error.name : 'unknown');
  }
}

/** The failure half of a Server Action result: the error body, after logging an unexpected error. */
export function failure(name: string, error: unknown): { ok: false; error: ErrorBody } {
  logUnexpected(name, error);
  return { ok: false, error: toErrorResponse(error).body };
}

/** Runs a process for the browser: it never throws to the client, it returns the error body. */
export async function run<T>(
  name: string,
  work: (headers: Headers) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work(await headers()) };
  } catch (error) {
    return failure(name, error);
  }
}

/**
 * The outcome of a no-JS `<form action>` that failed: not signed in goes to the login page, a
 * missing target is the 404 page, anything else is thrown (an unexpected error without its detail).
 */
export function formFailure(error: unknown, name: string): never {
  if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/accounts/login');
  if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
  throw error instanceof AppError ? error : new Error(`${name} failed`);
}
