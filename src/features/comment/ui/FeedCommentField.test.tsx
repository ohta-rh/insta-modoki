import { describe, expect, it, vi } from 'vitest';
import { submitFeedComment } from '../model/feed-comment';
import { MAX_BODY, TOO_LONG_MESSAGE } from '../model/schema';

const POST = '0198a0f0-0000-7000-8000-000000000001';
const ids = ['id-2', 'id-3', 'id-4'];
const newId = () => ids.shift()!;

describe('FeedCommentField', () => {
  it('失敗の後の再送は同じ clientRequestId を使い、成功の後は新しくする', async () => {
    const sent: string[] = [];
    const send = vi
      .fn()
      .mockImplementationOnce(async (input: { clientRequestId: string }) => {
        sent.push(input.clientRequestId);
        return { ok: false as const, error: { message: '通信に失敗しました' } };
      })
      .mockImplementationOnce(async (input: { clientRequestId: string }) => {
        sent.push(input.clientRequestId);
        return { ok: true as const };
      });
    const first = await submitFeedComment({
      postId: POST,
      body: 'いいね',
      requestId: 'id-1',
      send,
      newId,
    });
    expect(first).toEqual({ ok: false, message: '通信に失敗しました', requestId: 'id-1' });
    const second = await submitFeedComment({
      postId: POST,
      body: 'いいね',
      requestId: first.requestId,
      send,
      newId,
    });
    expect(second).toEqual({ ok: true, requestId: 'id-2' });
    expect(sent).toEqual(['id-1', 'id-1']);
  });

  it('2,200 字を超える文は送らずに理由を返し、2,200 字ちょうどは送る', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    const over = await submitFeedComment({
      postId: POST,
      body: 'あ'.repeat(MAX_BODY + 1),
      requestId: 'r',
      send,
      newId,
    });
    expect(over).toEqual({ ok: false, message: TOO_LONG_MESSAGE, requestId: 'r' });
    expect(send).not.toHaveBeenCalled();
    const exact = await submitFeedComment({
      postId: POST,
      body: '😀'.repeat(MAX_BODY),
      requestId: 'r',
      send,
      newId,
    });
    expect(exact.ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('通信が例外で失敗しても 理由を返して同じ id を残す', async () => {
    const send = vi.fn().mockRejectedValue(new Error('network'));
    const r = await submitFeedComment({ postId: POST, body: 'a', requestId: 'r', send, newId });
    expect(r.ok).toBe(false);
    expect(r.requestId).toBe('r');
  });
});
