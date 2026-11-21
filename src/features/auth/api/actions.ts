'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppError, toErrorResponse } from '../../../shared/errors';
import { getRequestEnv } from '../../../shared/db/request';
import type { AuthEnv } from './auth-env';
import { checkUsername } from './check-username';
import { signUp } from './sign-up';

export type SignUpState = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** What the user typed, so the form can keep it (never the password). */
  values?: { email: string; username: string; displayName: string };
};

const text = (data: FormData, name: string): string => {
  const v = data.get(name);
  return typeof v === 'string' ? v : '';
};

/** The sign-up form's Server Action. Success sets the session cookie and redirects (303) to `/`. */
export async function signUpAction(_prev: SignUpState, data: FormData): Promise<SignUpState> {
  const input = {
    email: text(data, 'email'),
    username: text(data, 'username'),
    displayName: text(data, 'displayName'),
    password: text(data, 'password'),
  };
  const values = { email: input.email, username: input.username, displayName: input.displayName };
  try {
    const result = await signUp(input, {
      env: await getRequestEnv<AuthEnv>(),
      headers: await headers(),
    });
    const { cookie } = result;
    (await cookies()).set(cookie.name, decodeURIComponent(cookie.value), {
      httpOnly: true,
      secure: cookie.secure,
      sameSite: 'lax',
      path: '/',
      maxAge: cookie.maxAgeSec,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return { message: error.message, fieldErrors: error.fieldErrors, values };
    }
    console.error('signUp failed', error instanceof Error ? error.name : 'unknown');
    return { message: toErrorResponse(error).body.message, values };
  }
  redirect('/');
}

/** Called when the username field loses focus. Returns what to show, never throws to the client. */
export async function checkUsernameAction(
  username: string,
): Promise<{ available: boolean } | { error: string }> {
  try {
    return await checkUsername({ username });
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.fieldErrors?.username?.[0] ?? error.message };
    }
    return { error: toErrorResponse(error).body.message };
  }
}
