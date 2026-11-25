import { afterEach, describe, expect, it, vi } from 'vitest';
import { runOperation } from './operations';
import { POST } from './route';

vi.mock('../../../shared/db/request', () => ({ getRequestEnv: async () => ({}) }));
vi.mock('./operations', async (importActual) => ({
  ...(await importActual<typeof import('./operations')>()),
  runOperation: vi.fn(),
}));

const post = (
  body: unknown,
  headers: Record<string, string> = { 'content-type': 'application/json' },
) =>
  POST(
    new Request('http://localhost/e2e-harness/db', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

const enable = () => {
  vi.stubEnv('E2E_HARNESS', '1');
  vi.stubEnv('APP_ENV', 'local');
};

describe('/e2e-harness/db', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('E2E_HARNESS が無いとき 404 にする', async () => {
    vi.stubEnv('E2E_HARNESS', '');
    vi.stubEnv('APP_ENV', 'local');
    expect((await post({ op: 'clearRateLimits' })).status).toBe(404);
  });

  it('seedSession is unreachable without E2E_HARNESS', async () => {
    vi.stubEnv('E2E_HARNESS', '');
    vi.stubEnv('APP_ENV', 'local');
    const res = await post({ op: 'seedSession', username: 'abc', email: 'a@example.com' });
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
    vi.stubEnv('E2E_HARNESS', '1');
    vi.stubEnv('APP_ENV', 'production');
    expect(
      (await post({ op: 'seedSession', username: 'abc', email: 'a@example.com' })).status,
    ).toBe(404);
  });

  it('E2E_HARNESS が 1 でも APP_ENV が local か test でないとき 404 にする', async () => {
    for (const appEnv of ['production', 'prod', 'Local', undefined]) {
      vi.stubEnv('E2E_HARNESS', '1');
      if (appEnv === undefined) vi.stubEnv('APP_ENV', undefined as unknown as string);
      else vi.stubEnv('APP_ENV', appEnv);
      expect((await post({ op: 'clearRateLimits' })).status, String(appEnv)).toBe(404);
    }
  });

  it('Content-Type が application/json でないとき 415 にする', async () => {
    enable();
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'application/jsonp']) {
      const res = await post({ op: 'clearRateLimits' }, { 'content-type': type });
      expect(res.status, type).toBe(415);
    }
    expect((await post({ op: 'clearRateLimits' }, {})).status).toBe(415);
  });

  it('Origin が自分の origin と違うとき 403 にする', async () => {
    enable();
    const res = await post(
      { op: 'clearRateLimits' },
      { 'content-type': 'application/json', origin: 'https://evil.example' },
    );
    expect(res.status).toBe(403);
  });

  it('同じ origin の JSON は検証まで進む', async () => {
    enable();
    const res = await post(
      { op: 'dropTable' },
      { 'content-type': 'application/json; charset=utf-8', origin: 'http://localhost' },
    );
    expect(res.status).toBe(422);
  });

  it('E2E_HARNESS が 1 で知らない操作や壊れた入力のとき 422 にする', async () => {
    enable();
    for (const body of [
      { op: 'dropTable' },
      { op: 'seedUser', username: 'x'.repeat(200), email: 'a@example.com' },
      { op: 'insertPost', id: 'a', authorId: 'b', caption: '', createdAt: 1, media: [] },
      { op: 'seedUser', username: 'abc', email: 'a@example.com', sql: 'DELETE FROM users' },
      { op: 'seedLikers', postId: 'p', likers: [] },
      {
        op: 'seedLikers',
        postId: 'p',
        likers: Array.from({ length: 51 }, () => ({ username: 'u', email: 'e', likedAt: 1 })),
      },
      {
        op: 'seedLikers',
        postId: 'p',
        likers: [{ username: 'u', email: 'e', likedAt: 1, sql: 'x' }],
      },
      { op: 'seedLikers', likers: [{ username: 'u', email: 'e', likedAt: 1 }] },
      { op: 'deletePost' },
      { op: 'deletePost', postId: 'p', all: true },
      'not json',
      [],
    ]) {
      expect((await post(body)).status, JSON.stringify(body)).toBe(422);
    }
  });
});

describe('/e2e-harness/db（コメントの操作）', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('insertComments の壊れた入力のとき 422 にする', async () => {
    enable();
    const row = { id: 'a', postId: 'b', authorId: 'c', parentId: null, body: 'x', createdAt: 1 };
    for (const body of [
      { op: 'insertComments', comments: [] },
      { op: 'insertComments', comments: Array.from({ length: 101 }, () => row) },
      { op: 'insertComments', comments: [{ ...row, body: '' }] },
      { op: 'insertComments', comments: [{ ...row, sql: 'DELETE FROM users' }] },
    ]) {
      expect((await post(body)).status, JSON.stringify(body).slice(0, 60)).toBe(422);
    }
  });
});

describe('/e2e-harness/db（失敗の操作）', () => {
  const seed = { op: 'seedUser', username: 'abc', email: 'a@example.com' };
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.mocked(runOperation).mockReset();
  });

  it('a failing operation answers 500 with the op, error name and message', async () => {
    enable();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(runOperation).mockRejectedValue(new TypeError('boom'));
    const res = await post(seed);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: 'operation failed',
      op: 'seedUser',
      name: 'TypeError',
      message: 'boom',
    });
  });

  it('a failing operation is logged with its op', async () => {
    enable();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(runOperation).mockRejectedValue(new TypeError('boom'));
    await post(seed);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('[e2e-harness] seedUser failed: TypeError: boom');
  });

  it('a non-Error throw still answers 500 with a message', async () => {
    enable();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(runOperation).mockRejectedValue('plain');
    const res = await post(seed);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ name: 'unknown', message: 'plain' });
  });

  it('cuts a long message to 500 characters', async () => {
    enable();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(runOperation).mockRejectedValue(new Error('x'.repeat(900)));
    const body = (await (await post(seed)).json()) as { message: string };
    expect(body.message).toHaveLength(500);
  });

  it('a disabled harness stays a bodiless 404 even when the operation would fail', async () => {
    vi.stubEnv('E2E_HARNESS', '');
    vi.stubEnv('APP_ENV', 'local');
    vi.mocked(runOperation).mockRejectedValue(new Error('boom'));
    const res = await post(seed);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
  });
});
