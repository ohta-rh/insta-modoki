import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FollowButton } from './FollowButton';
import { FollowScope } from './FollowScope';
import {
  createFollowController,
  type FollowSendResult,
  type FollowSnapshot,
} from '../model/follow-controller';

/** A send() the test settles by hand, recording how many requests are open at once. */
function manualServer() {
  const calls: boolean[] = [];
  const pending: Array<(r: FollowSendResult) => void> = [];
  let open = 0;
  let maxOpen = 0;
  const send = (following: boolean) =>
    new Promise<FollowSendResult>((resolve) => {
      calls.push(following);
      open += 1;
      maxOpen = Math.max(maxOpen, open);
      pending.push((r) => {
        open -= 1;
        resolve(r);
      });
    });
  const settleNext = (result?: FollowSendResult) => {
    const settle = pending.shift()!;
    settle(result ?? { ok: true, following: calls[calls.length - 1]!, followerCount: 0 });
  };
  return { send, calls, settleNext, maxOpen: () => maxOpen, pendingCount: () => pending.length };
}
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('FollowButton', () => {
  it('押すとサーバーの応答を待たずに「フォロー中」とフォロワー数 +1 に変わる', async () => {
    const seen: FollowSnapshot[] = [];
    const server = manualServer();
    const c = createFollowController({
      initial: { following: false, count: 3 },
      send: server.send,
      onChange: (s) => seen.push(s),
    });
    c.press();
    expect(c.snapshot()).toMatchObject({ following: true, count: 4, error: null });
    expect(server.calls).toEqual([true]);
    server.settleNext({ ok: true, following: true, followerCount: 4 });
    await tick();
    expect(c.snapshot()).toMatchObject({ following: true, count: 4 });
    expect(seen.length).toBeGreaterThan(0);
  });

  it('解除すると「フォローする」とフォロワー数 -1 に変わる', async () => {
    const server = manualServer();
    const c = createFollowController({
      initial: { following: true, count: 3 },
      send: server.send,
      onChange: () => {},
    });
    c.press();
    expect(c.snapshot()).toMatchObject({ following: false, count: 2 });
    expect(server.calls).toEqual([false]);
  });

  it('応答のフォロワー数がほかの人のフォローを含むとき その数に置き換わる', async () => {
    const server = manualServer();
    const c = createFollowController({
      initial: { following: false, count: 3 },
      send: server.send,
      onChange: () => {},
    });
    c.press();
    server.settleNext({ ok: true, following: true, followerCount: 9 });
    await tick();
    expect(c.snapshot()).toMatchObject({ following: true, count: 9 });
  });

  it('サーバーが失敗を返したとき表示を元に戻し message を出す', async () => {
    const message = '操作が多すぎます。しばらくしてからもう一度お試しください';
    const server = manualServer();
    const c = createFollowController({
      initial: { following: false, count: 3 },
      send: server.send,
      onChange: () => {},
    });
    c.press();
    expect(c.snapshot()).toMatchObject({ following: true, count: 4 });
    server.settleNext({ ok: false, code: 'RATE_LIMITED', message });
    await tick();
    expect(c.snapshot()).toMatchObject({
      following: false,
      count: 3,
      error: message,
      needsLogin: false,
    });
    // The next press clears the message.
    c.press();
    expect(c.snapshot().error).toBeNull();
  });

  it('通信が例外で終わったとき 固定の文言で押す前に戻る', async () => {
    const c = createFollowController({
      initial: { following: true, count: 1 },
      send: () => Promise.reject(new Error('boom: SELECT secret')),
      onChange: () => {},
    });
    c.press();
    await tick();
    const s = c.snapshot();
    expect(s).toMatchObject({ following: true, count: 1 });
    expect(s.error).toBe('エラーが発生しました。しばらくしてからもう一度お試しください');
  });

  it('ログインしていないとき needsLogin が立つ', async () => {
    const server = manualServer();
    const c = createFollowController({
      initial: { following: false, count: 0 },
      send: server.send,
      onChange: () => {},
    });
    c.press();
    server.settleNext({ ok: false, code: 'UNAUTHENTICATED', message: 'ログインしてください' });
    await tick();
    expect(c.snapshot()).toMatchObject({ following: false, needsLogin: true });
  });

  it('続けて 5 回押すと最後の状態になり、同時のリクエストは 1 つ', async () => {
    const server = manualServer();
    const c = createFollowController({
      initial: { following: false, count: 0 },
      send: server.send,
      onChange: () => {},
    });
    for (let i = 0; i < 5; i += 1) c.press();
    expect(c.snapshot()).toMatchObject({ following: true, count: 1 });
    expect(server.pendingCount()).toBe(1);
    server.settleNext({ ok: true, following: true, followerCount: 1 });
    await tick();
    // The server's answer matches the last wanted state: nothing more is sent.
    expect(server.calls).toEqual([true]);
    expect(server.maxOpen()).toBe(1);
  });

  it('送信中に押して望む状態が変わったとき 完了後に 1 回だけ送り直す', async () => {
    const server = manualServer();
    const c = createFollowController({
      initial: { following: false, count: 0 },
      send: server.send,
      onChange: () => {},
    });
    c.press();
    c.press();
    expect(server.calls).toEqual([true]);
    server.settleNext({ ok: true, following: true, followerCount: 1 });
    await tick();
    expect(server.calls).toEqual([true, false]);
    expect(server.maxOpen()).toBe(1);
    server.settleNext({ ok: true, following: false, followerCount: 0 });
    await tick();
    expect(c.snapshot()).toMatchObject({ following: false, count: 0 });
    expect(server.calls).toHaveLength(2);
  });

  it('送り直しが失敗したとき サーバーが最後に確定した状態へ戻る', async () => {
    const server = manualServer();
    const c = createFollowController({
      initial: { following: false, count: 0 },
      send: server.send,
      onChange: () => {},
    });
    c.press();
    c.press();
    server.settleNext({ ok: true, following: true, followerCount: 1 });
    await tick();
    server.settleNext({ ok: false, code: 'RATE_LIMITED', message: 'x' });
    await tick();
    expect(c.snapshot()).toMatchObject({ following: true, count: 1, error: 'x' });
  });
});

describe('FollowButton の見た目', () => {
  const render = (variant?: 'button' | 'text', following = false) =>
    renderToStaticMarkup(
      <FollowScope username="bob" initialFollowing={following} initialFollowerCount={0} signedIn>
        <FollowButton variant={variant} />
      </FollowScope>,
    );

  it('variant が text のとき インディゴの 12px の文字で「フォロー」と描く', () => {
    const html = render('text');
    expect(html).toContain('text-indigo');
    expect(html).toContain('text-[length:var(--font-size-xs)]');
    expect(html).toMatch(/<button[^>]*>フォロー<\/button>/);
  });

  it('variant が text でフォロー中のとき 「フォロー中」と描き インディゴでなくなる', () => {
    const html = render('text', true);
    expect(html).toMatch(/<button[^>]*>フォロー中<\/button>/);
    expect(html).not.toContain('text-indigo');
  });

  it('variant が text のとき 行ごとに違う名前を aria-label に持ち aria-pressed も付く', () => {
    const html = render('text');
    expect(html).toContain('aria-label="bob をフォロー"');
    expect(html).toContain('aria-pressed="false"');
    expect(render('text', true)).toMatch(/aria-label="bob をフォロー中"/);
  });

  it('variant が無いとき 今までの「フォローする」のボタンのまま', () => {
    const html = render();
    expect(html).toMatch(/<button[^>]*>フォローする<\/button>/);
    expect(html).toContain('bg-link');
  });
});
