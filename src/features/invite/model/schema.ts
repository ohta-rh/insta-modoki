import { z } from 'zod';
import { CODE_PATTERN, normalizeCode } from './code';

export type FieldErrors = Record<string, string[]>;
export type ParseResult<T> = { ok: true; data: T } | { ok: false; fieldErrors: FieldErrors };

export const MESSAGES = {
  maxUses: '使用回数は 1 から 100 までです',
  expiresInDays: '有効日数は 1 から 90 までです',
  code: '招待コードが正しくありません',
} as const;

export const DEFAULT_EXPIRES_IN_DAYS = 7;
export const INVITE_PAGE_SIZE = 20;

const intBetween = (min: number, max: number, message: string) =>
  z.number({ error: message }).int(message).min(min, message).max(max, message);

export const createInviteInput = z.strictObject({
  maxUses: intBetween(1, 100, MESSAGES.maxUses),
  expiresInDays: intBetween(1, 90, MESSAGES.expiresInDays).default(DEFAULT_EXPIRES_IN_DAYS),
});

export const listInvitesInput = z.strictObject({ cursor: z.string().optional() });

/** The code is cleaned the way a signed-up person's input is, then must have the code's shape. */
export const revokeInviteInput = z.strictObject({
  code: z
    .string({ error: MESSAGES.code })
    .transform(normalizeCode)
    .refine((v) => CODE_PATTERN.test(v), MESSAGES.code),
});

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

export const parseCreateInvite = (input: unknown) => parse(createInviteInput, input);
export const parseListInvites = (input: unknown) => parse(listInvitesInput, input);
export const parseRevokeInvite = (input: unknown) => parse(revokeInviteInput, input);
