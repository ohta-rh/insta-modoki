import { afterEach, describe, expect, it, vi } from 'vitest';
import { E2E_INVITE_HEADER, isInviteRequired } from './invite-required';

const env = (INVITE_REQUIRED?: string) => ({ INVITE_REQUIRED }) as never;
const withHeader = new Headers({ [E2E_INVITE_HEADER]: 'true' });

afterEach(() => vi.unstubAllEnvs());

describe('isInviteRequired', () => {
  it('INVITE_REQUIRED が文字列の true のときだけ必須で、未設定やほかの値は必須でない', () => {
    expect(isInviteRequired(env('true'), new Headers())).toBe(true);
    for (const v of [undefined, '', 'false', 'TRUE', '1', 'true ']) {
      expect(isInviteRequired(env(v), new Headers()), String(v)).toBe(false);
    }
  });

  it('E2E 用のヘッダーは E2E_HARNESS=1 かつ APP_ENV が local か test のときだけ効く', () => {
    expect(isInviteRequired(env(), withHeader)).toBe(false);
    vi.stubEnv('E2E_HARNESS', '1');
    expect(isInviteRequired(env(), withHeader)).toBe(false);
    vi.stubEnv('APP_ENV', 'production');
    expect(isInviteRequired(env(), withHeader)).toBe(false);
    vi.stubEnv('APP_ENV', 'local');
    expect(isInviteRequired(env(), withHeader)).toBe(true);
    expect(isInviteRequired(env(), new Headers())).toBe(false);
    expect(isInviteRequired(env(), new Headers({ [E2E_INVITE_HEADER]: 'yes' }))).toBe(false);
    vi.stubEnv('E2E_HARNESS', '0');
    expect(isInviteRequired(env(), withHeader)).toBe(false);
  });
});
