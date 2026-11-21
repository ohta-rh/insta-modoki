import { describe, expect, it } from 'vitest';
import {
  createLikeController,
  type LikeSendResult,
  type LikeSnapshot,
} from '../model/like-controller';

/** A send() the test settles by hand, recording how many requests are open at once. */
function manualServer() {
  const calls: boolean[] = [];
  const pending: Array<(r: LikeSendResult) => void> = [];
  let open = 0;
  let maxOpen = 0;
  const send = (liked: boolean) =>
    new Promise<LikeSendResult>((resolve) => {
      calls.push(liked);
      open += 1;
      maxOpen = Math.max(maxOpen, open);
      pending.push((r) => {
        open -= 1;
        resolve(r);
      });
    });
  const settleNext = (result?: LikeSendResult) => {
    const settle = pending.shift()!;
    settle(result ?? { ok: true, liked: calls[calls.length - 1]!, likeCount: 0 });
  };
  return { send, calls, settleNext, maxOpen: () => maxOpen, pendingCount: () => pending.length };
}
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('LikeButton', () => {
  it('押すとサーバーの応答を待たずに塗りつぶしと件数 +1 に変わる', async () => {
    const seen: LikeSnapshot[] = [];
    const server = manualServer();
    const c = createLikeController({
      initial: { liked: false, count: 3 },
      send: server.send,
      onChange: (s) => seen.push(s),
    });
    c.press();
    expect(c.snapshot()).toMatchObject({ liked: true, count: 4, error: null });
    expect(server.calls).toEqual([true]);
    server.settleNext({ ok: true, liked: true, likeCount: 4 });
    await tick();
    expect(c.snapshot()).toMatchObject({ liked: true, count: 4 });
  });

  it('応答の件数がほかの人のいいねを含むとき その件数に置き換わる', async () => {
    const server = manualServer();
    const c = createLikeController({
      initial: { liked: false, count: 3 },
      send: server.send,
      onChange: () => {},
    });
    c.press();
    server.settleNext({ ok: true, liked: true, likeCount: 9 });
    await tick();
    expect(c.snapshot()).toMatchObject({ liked: true, count: 9 });
  });

  it('失敗したとき押す前の状態に戻し message を出す', async () => {
    const message = '操作が多すぎます。しばらくしてからもう一度お試しください';
    const server = manualServer();
    const c = createLikeController({
      initial: { liked: false, count: 3 },
      send: server.send,
      onChange: () => {},
    });
    c.press();
    expect(c.snapshot()).toMatchObject({ liked: true, count: 4 });
    server.settleNext({ ok: false, code: 'RATE_LIMITED', message });
    await tick();
    expect(c.snapshot()).toMatchObject({
      liked: false,
      count: 3,
      error: message,
      needsLogin: false,
    });
    // The next press clears the message.
    c.press();
    expect(c.snapshot().error).toBeNull();
  });

  it('通信が例外で終わったとき 固定の文言で押す前に戻る', async () => {
    const c = createLikeController({
      initial: { liked: true, count: 1 },
      send: () => Promise.reject(new Error('boom: SELECT secret')),
      onChange: () => {},
    });
    c.press();
    await tick();
    const s = c.snapshot();
    expect(s).toMatchObject({ liked: true, count: 1 });
    expect(s.error).toBe('エラーが発生しました。しばらくしてからもう一度お試しください');
  });

  it('ログインしていないとき needsLogin が立つ', async () => {
    const server = manualServer();
    const c = createLikeController({
      initial: { liked: false, count: 0 },
      send: server.send,
      onChange: () => {},
    });
    c.press();
    server.settleNext({ ok: false, code: 'UNAUTHENTICATED', message: 'ログインしてください' });
    await tick();
    expect(c.snapshot()).toMatchObject({ liked: false, needsLogin: true });
  });

  it('続けて 5 回押すと最後の状態になり、同時のリクエストは 1 つ', async () => {
    const server = manualServer();
    const c = createLikeController({
      initial: { liked: false, count: 0 },
      send: server.send,
      onChange: () => {},
    });
    for (let i = 0; i < 5; i += 1) c.press();
    expect(c.snapshot()).toMatchObject({ liked: true, count: 1 });
    expect(server.pendingCount()).toBe(1);

    server.settleNext({ ok: true, liked: true, likeCount: 1 });
    await tick();
    // The server's answer matches the last wanted state: nothing more is sent.
    expect(server.calls).toEqual([true]);
    expect(server.maxOpen()).toBe(1);
    expect(c.snapshot()).toMatchObject({ liked: true, count: 1 });
  });

  it('送信中に押して望む状態が変わったとき 完了後に 1 回だけ送り直す', async () => {
    const server = manualServer();
    const c = createLikeController({
      initial: { liked: false, count: 0 },
      send: server.send,
      onChange: () => {},
    });
    c.press(); // like, sent
    c.press(); // unlike while the first is open
    expect(server.calls).toEqual([true]);
    server.settleNext({ ok: true, liked: true, likeCount: 1 });
    await tick();
    expect(server.calls).toEqual([true, false]);
    expect(server.maxOpen()).toBe(1);
    server.settleNext({ ok: true, liked: false, likeCount: 0 });
    await tick();
    expect(c.snapshot()).toMatchObject({ liked: false, count: 0 });
    expect(server.calls).toHaveLength(2);
  });

  it('送り直しが失敗したとき サーバーが最後に確定した状態へ戻る', async () => {
    const server = manualServer();
    const c = createLikeController({
      initial: { liked: false, count: 0 },
      send: server.send,
      onChange: () => {},
    });
    c.press();
    c.press();
    server.settleNext({ ok: true, liked: true, likeCount: 1 });
    await tick();
    server.settleNext({ ok: false, code: 'RATE_LIMITED', message: 'x' });
    await tick();
    expect(c.snapshot()).toMatchObject({ liked: true, count: 1, error: 'x' });
  });

  it('ダブルタップ（like）はいいね済みのとき何も送らず 取り消さない', async () => {
    const server = manualServer();
    const c = createLikeController({
      initial: { liked: true, count: 1 },
      send: server.send,
      onChange: () => {},
    });
    c.like();
    c.like();
    expect(server.calls).toEqual([]);
    expect(c.snapshot()).toMatchObject({ liked: true, count: 1 });
  });

  it('いいね前のダブルタップは 1 回だけ送る', async () => {
    const server = manualServer();
    const c = createLikeController({
      initial: { liked: false, count: 0 },
      send: server.send,
      onChange: () => {},
    });
    c.like();
    c.like();
    expect(server.calls).toEqual([true]);
  });
});
