import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/e2e-harness/db', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

describe('/e2e-harness/db', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('E2E_HARNESS が無いとき 404 にする', async () => {
    vi.stubEnv('E2E_HARNESS', '');
    vi.stubEnv('APP_ENV', 'local');
    expect((await post({ op: 'clearRateLimits' })).status).toBe(404);
  });

  it('E2E_HARNESS が 1 でも APP_ENV が production のとき 404 にする', async () => {
    vi.stubEnv('E2E_HARNESS', '1');
    vi.stubEnv('APP_ENV', 'production');
    expect((await post({ op: 'clearRateLimits' })).status).toBe(404);
  });

  it('E2E_HARNESS が 1 で知らない操作や壊れた入力のとき 422 にする', async () => {
    vi.stubEnv('E2E_HARNESS', '1');
    vi.stubEnv('APP_ENV', 'local');
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
