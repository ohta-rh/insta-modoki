import { describe, expect, it } from 'vitest';
import { parseCreateInvite, parseListInvites, parseRevokeInvite } from './schema';

const MAX_USES = '使用回数は 1 から 100 までです';
const DAYS = '有効日数は 1 から 90 までです';

describe('createInviteInput', () => {
  it('maxUses は 1 と 100 を通し 0 と 101 を拒む', () => {
    expect(parseCreateInvite({ maxUses: 1 })).toEqual({
      ok: true,
      data: { maxUses: 1, expiresInDays: 7 },
    });
    expect(parseCreateInvite({ maxUses: 100 })).toMatchObject({ ok: true });
    for (const bad of [0, 101, 1.5, '5', null, undefined]) {
      expect(parseCreateInvite({ maxUses: bad }), String(bad)).toEqual({
        ok: false,
        fieldErrors: { maxUses: [MAX_USES] },
      });
    }
  });

  it('expiresInDays は 1 と 90 を通し 91 を拒み、省くと 7', () => {
    expect(parseCreateInvite({ maxUses: 1, expiresInDays: 1 })).toMatchObject({
      ok: true,
      data: { expiresInDays: 1 },
    });
    expect(parseCreateInvite({ maxUses: 1, expiresInDays: 90 })).toMatchObject({ ok: true });
    expect(parseCreateInvite({ maxUses: 1 })).toMatchObject({ data: { expiresInDays: 7 } });
    for (const bad of [0, 91, 2.5, '7']) {
      expect(parseCreateInvite({ maxUses: 1, expiresInDays: bad }), String(bad)).toEqual({
        ok: false,
        fieldErrors: { expiresInDays: [DAYS] },
      });
    }
  });

  it('知らない項目は VALIDATION になる（strict）', () => {
    expect(parseCreateInvite({ maxUses: 1, createdBy: 'x' })).toMatchObject({ ok: false });
  });
});

describe('listInvitesInput / revokeInviteInput', () => {
  it('cursor は省ける文字列で、知らない項目は拒む', () => {
    expect(parseListInvites({})).toEqual({ ok: true, data: {} });
    expect(parseListInvites(undefined)).toEqual({ ok: true, data: {} });
    expect(parseListInvites({ cursor: 'abc' })).toEqual({ ok: true, data: { cursor: 'abc' } });
    expect(parseListInvites({ cursor: 1 })).toMatchObject({ ok: false });
    expect(parseListInvites({ limit: 1 })).toMatchObject({ ok: false });
  });

  it('code は前後の空白を除き大文字にし、形式が違えば拒む', () => {
    expect(parseRevokeInvite({ code: ' abcde12345 ' })).toEqual({
      ok: true,
      data: { code: 'ABCDE12345' },
    });
    for (const bad of ['ABC', 'ABCDE1234!', 'ABCDE123456', 1, undefined]) {
      expect(parseRevokeInvite({ code: bad }), String(bad)).toMatchObject({ ok: false });
    }
  });
});
