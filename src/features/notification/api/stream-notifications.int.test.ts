import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { seedNotifications } from '../../../../tests/helpers/notifications';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { streamNotifications } from './stream-notifications';

const t = useTestDb();
afterEach(() => vi.restoreAllMocks());

const URL_ = 'https://app.test/api/notifications/stream';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reads a streamed body: `text` grows as chunks arrive, `done` flips when the response ends. */
function listen(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const state = { text: '', done: false };
  const loop = (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        state.done = true;
        return;
      }
      state.text += decoder.decode(value, { stream: true });
    }
  })().catch(() => {
    state.done = true;
  });
  const until = async (check: () => boolean, timeoutMs = 3000) => {
    const start = Date.now();
    while (!check()) {
      if (Date.now() - start > timeoutMs)
        throw new Error(`timeout; got ${JSON.stringify(state.text)}`);
      await sleep(5);
    }
  };
  return { state, until, cancel: () => reader.cancel(), loop };
}

const eventsIn = (text: string) =>
  [...text.matchAll(/data: (\{"unreadCount":\d+\})/g)].map((m) => m[1]);

/** The test D1 with a switch that makes every query throw, and a count of the queries. */
function flaky(d1: unknown) {
  const control = { fail: false, calls: 0 };
  const proxy = new Proxy(d1 as object, {
    get(target, prop, receiver) {
      if (prop === 'prepare' || prop === 'batch') {
        return (...args: unknown[]) => {
          control.calls += 1;
          if (control.fail) throw new Error('SELECT secret FROM /private/path failed');
          return (Reflect.get(target, prop, receiver) as (...a: unknown[]) => unknown).apply(
            target,
            args,
          );
        };
      }
      const v = Reflect.get(target, prop, receiver);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  return { d1: proxy, control };
}

describe('streamNotifications', () => {
  it('未ログインを 401 で拒み、イベントを流さない', async () => {
    const env = testAuthEnv(t.d1);
    for (const cookie of [undefined, 'better-auth.session_token=broken.value']) {
      const headers = new Headers(cookie ? { cookie } : {});
      const response = await streamNotifications(new Request(URL_, { headers }), { env });
      expect(response.status).toBe(401);
      expect(response.headers.get('content-type')).not.toContain('text/event-stream');
      expect(await response.json()).toEqual({
        code: 'UNAUTHENTICATED',
        message: 'ログインしてください',
      });
    }
  });

  // The test waits out the 1500ms window by design: 1,562-1,584ms alone (measured 2026-11-23, #107).
  // The default 5s limit would put the 25% budget (ADR-0059) at 1,250ms, below that wait, so the limit
  // is 15s (budget 3,750ms: 2x headroom over the measured time).
  it('接続直後に現在の数を送り、変わったときだけ送り、印を送り、時間で閉じる', async () => {
    const env = testAuthEnv(t.d1);
    const a = await createUser(t.db);
    const b = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, a);
    await seedNotifications(t.db, { recipientId: a.id, actorId: b.id, count: 2 });

    const started = Date.now();
    const response = await streamNotifications(new Request(URL_, { headers }), {
      env,
      intervals: { tickMs: 20, pingMs: 50, windowMs: 1500 },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const s = listen(response);

    // First: retry and the current count, once.
    await s.until(() => s.state.text.includes('data: {"unreadCount":2}'));
    expect(s.state.text).toContain('retry: 1000\n\n');
    expect(s.state.text).toContain('event: unread\ndata: {"unreadCount":2}\n\n');

    // Nothing changes: a ping line comes, no second event.
    await s.until(() => s.state.text.includes(': ping\n\n'));
    expect(eventsIn(s.state.text)).toEqual(['{"unreadCount":2}']);

    // The newest row changes but the count does not (the new row is read): no event.
    await seedNotifications(t.db, {
      recipientId: a.id,
      actorId: b.id,
      count: 1,
      offset: 2,
      read: true,
    });
    await sleep(120);
    expect(eventsIn(s.state.text)).toEqual(['{"unreadCount":2}']);

    // An unread row: one event with the new count.
    await seedNotifications(t.db, { recipientId: a.id, actorId: b.id, count: 1, offset: 3 });
    await s.until(() => s.state.text.includes('data: {"unreadCount":3}'));
    expect(eventsIn(s.state.text)).toEqual(['{"unreadCount":2}', '{"unreadCount":3}']);

    // The response ends by itself when the window is over.
    await s.until(() => s.state.done, 4000);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1500);
  }, 15_000);

  it('他人宛ての通知ではイベントを送らない', async () => {
    const env = testAuthEnv(t.d1);
    const a = await createUser(t.db);
    const b = await createUser(t.db);
    const c = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, a);
    const response = await streamNotifications(new Request(`${URL_}?userId=${b.id}`, { headers }), {
      env,
      intervals: { tickMs: 20, pingMs: 1000, windowMs: 400 },
    });
    const s = listen(response);
    await s.until(() => s.state.text.includes('data: {"unreadCount":0}'));
    await seedNotifications(t.db, { recipientId: b.id, actorId: c.id, count: 3 });
    await s.until(() => s.state.done);
    expect(eventsIn(s.state.text)).toEqual(['{"unreadCount":0}']);
  });

  it('未読が上限を超えても 100 を送る', async () => {
    const env = testAuthEnv(t.d1);
    const a = await createUser(t.db);
    const b = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, a);
    await seedNotifications(t.db, { recipientId: a.id, actorId: b.id, count: 101 });
    const response = await streamNotifications(new Request(URL_, { headers }), {
      env,
      intervals: { tickMs: 20, pingMs: 1000, windowMs: 200 },
    });
    const s = listen(response);
    await s.until(() => s.state.done);
    expect(eventsIn(s.state.text)).toEqual(['{"unreadCount":100}']);
  });

  it('問い合わせが失敗したら内部の情報を出さずに閉じる', async () => {
    const real = testAuthEnv(t.d1);
    const a = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, real, a);
    const { d1, control } = flaky(t.d1);
    const env = { ...real, DB: d1 as never };
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await streamNotifications(new Request(URL_, { headers }), {
      env,
      intervals: { tickMs: 20, pingMs: 1000, windowMs: 5000 },
    });
    const s = listen(response);
    await s.until(() => s.state.text.includes('data: {"unreadCount":0}'));
    control.fail = true;
    await s.until(() => s.state.done, 1000);
    expect(eventsIn(s.state.text)).toEqual(['{"unreadCount":0}']);
    expect(logged).toHaveBeenCalledWith('streamNotifications failed', 'Error');
    expect(JSON.stringify(logged.mock.calls)).not.toMatch(/SELECT|private|path|at /);
    expect(s.state.text).not.toMatch(/SELECT|private|error/i);
  });

  it('切断したら確認を止める', async () => {
    const real = testAuthEnv(t.d1);
    const a = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, real, a);
    const { d1, control } = flaky(t.d1);
    const env = { ...real, DB: d1 as never };

    // The reader cancels the body.
    const first = await streamNotifications(new Request(URL_, { headers }), {
      env,
      intervals: { tickMs: 20, pingMs: 1000, windowMs: 5000 },
    });
    const s = listen(first);
    await s.until(() => s.state.text.includes('unreadCount'));
    await s.cancel();
    await sleep(60);
    const afterCancel = control.calls;
    await sleep(150);
    expect(control.calls).toBe(afterCancel);

    // The request is aborted.
    const abort = new AbortController();
    const second = await streamNotifications(new Request(URL_, { headers, signal: abort.signal }), {
      env,
      intervals: { tickMs: 20, pingMs: 1000, windowMs: 5000 },
    });
    const s2 = listen(second);
    await s2.until(() => s2.state.text.includes('unreadCount'));
    abort.abort();
    await sleep(60);
    const afterAbort = control.calls;
    await sleep(150);
    expect(control.calls).toBe(afterAbort);
  });
});
