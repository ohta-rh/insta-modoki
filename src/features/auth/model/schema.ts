import { z } from 'zod';
import { charLength, hasControlChars } from '../../../shared/text';
import { isReservedUsername } from './reserved-usernames';

export type FieldErrors = Record<string, string[]>;
export type ParseResult<T> = { ok: true; data: T } | { ok: false; fieldErrors: FieldErrors };

export const MESSAGES = {
  email: 'メールアドレスの形式を確認してください',
  usernameLength: 'ユーザー名は 3〜30 字で入力してください',
  usernameFormat: 'ユーザー名は英小文字・数字・.・_ だけ使えます（先頭と末尾は . 以外、.. は不可）',
  usernameReserved: 'このユーザー名は使えません',
  displayName: '表示名は 1〜30 字で入力してください',
  password: 'パスワードは 8〜72 字で入力してください',
} as const;

const USERNAME_SHAPE = /^[a-z0-9_]([a-z0-9._]*[a-z0-9_])?$/;

/** Lower-cases (Unicode) first: SQLite's lower() is ASCII-only, so the app does it before saving. */
const username = z
  .string({ error: MESSAGES.usernameLength })
  .transform((v) => v.toLowerCase())
  .superRefine((v, ctx) => {
    const n = charLength(v);
    if (n < 3 || n > 30) {
      ctx.addIssue({ code: 'custom', message: MESSAGES.usernameLength });
    } else if (!USERNAME_SHAPE.test(v) || v.includes('..') || hasControlChars(v)) {
      ctx.addIssue({ code: 'custom', message: MESSAGES.usernameFormat });
    } else if (isReservedUsername(v)) {
      ctx.addIssue({ code: 'custom', message: MESSAGES.usernameReserved });
    }
  });

const email = z
  .string({ error: MESSAGES.email })
  .transform((v) => v.trim().toLowerCase())
  .pipe(
    z
      .string()
      .max(254, MESSAGES.email)
      .refine((v) => !hasControlChars(v), MESSAGES.email)
      .pipe(z.email({ error: MESSAGES.email })),
  );

const displayName = z
  .string({ error: MESSAGES.displayName })
  .transform((v) => v.trim())
  .refine((v) => charLength(v) >= 1 && charLength(v) <= 30 && !hasControlChars(v), {
    error: MESSAGES.displayName,
  });

const password = z
  .string({ error: MESSAGES.password })
  .refine((v) => charLength(v) >= 8 && charLength(v) <= 72, { error: MESSAGES.password });

const signUpSchema = z.object({ email, username, displayName, password });
const usernameOnlySchema = z.object({ username });

export type SignUpInput = z.output<typeof signUpSchema>;

function parse<S extends z.ZodType>(schema: S, input: unknown): ParseResult<z.output<S>> {
  const r = schema.safeParse(input ?? {});
  if (r.success) return { ok: true, data: r.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    const list = (fieldErrors[key] ??= []);
    if (!list.includes(issue.message)) list.push(issue.message);
  }
  return { ok: false, fieldErrors };
}

export const parseSignUp = (input: unknown) => parse(signUpSchema, input);
export const parseUsername = (input: unknown) => parse(usernameOnlySchema, input);

/** True only for a username that parseUsername would accept unchanged (safe to put in a URL path). */
export const isValidUsernameFormat = (value: string): boolean => {
  const r = parseUsername({ username: value });
  return r.ok && r.data.username === value;
};
