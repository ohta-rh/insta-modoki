import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

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
      'not json',
      [],
    ]) {
      expect((await post(body)).status, JSON.stringify(body)).toBe(422);
    }
  });
});
