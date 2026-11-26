import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('../../../public/sw.js', import.meta.url)),
  'utf8',
);

type Handler = (event: unknown) => void;

/** Runs public/sw.js against fakes of `self`, `caches`, `fetch` and `clients`. */
function load(opts: { existing?: string[]; fetchImpl?: (req: unknown) => Promise<unknown> } = {}) {
  const handlers: Record<string, Handler> = {};
  const offlineResponse = { offline: true };
  const cache = { put: vi.fn().mockResolvedValue(undefined) };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(opts.existing ?? []),
    delete: vi.fn().mockResolvedValue(true),
    match: vi.fn().mockResolvedValue(offlineResponse),
  };
  const self = {
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn;
    },
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
  };
  const fetchFn = vi.fn(
    opts.fetchImpl ?? (() => Promise.resolve(new Response('ok', { status: 200 }))),
  );
  new Function('self', 'caches', 'fetch', source)(self, caches, fetchFn, undefined);
  const waits: Promise<unknown>[] = [];
  const ext = (extra: object = {}) => ({
    waitUntil: (p: Promise<unknown>) => waits.push(p),
    respondWith: (p: Promise<unknown>) => waits.push(p),
    ...extra,
  });
  return { handlers, cache, caches, self, fetchFn, waits, ext, offlineResponse };
}

describe('public/sw.js', () => {
  it('インストールで案内の画面だけをキャッシュに入れる', async () => {
    const s = load();
    s.handlers.install(s.ext());
    await Promise.all(s.waits);
    expect(s.caches.open).toHaveBeenCalledWith('offline-v1');
    expect(s.cache.put).toHaveBeenCalledTimes(1);
    expect(s.cache.put.mock.calls[0][0]).toBe('/assets/offline.html');
    expect(s.self.skipWaiting).toHaveBeenCalled();
  });

  it('リダイレクトされた応答は、redirected でない応答にして入れる（ナビゲーションに使えないため）', async () => {
    const redirected = new Response('<h1>x</h1>');
    Object.defineProperty(redirected, 'redirected', { value: true });
    const s = load({ fetchImpl: () => Promise.resolve(redirected) });
    s.handlers.install(s.ext());
    await Promise.all(s.waits);
    const stored = s.cache.put.mock.calls[0][1] as Response;
    expect(stored.redirected).toBe(false);
    expect(await stored.text()).toBe('<h1>x</h1>');
  });

  it('案内の画面が取れなかったら、インストールを失敗させる', async () => {
    const s = load({ fetchImpl: () => Promise.resolve(new Response('', { status: 404 })) });
    s.handlers.install(s.ext());
    await expect(Promise.all(s.waits)).rejects.toThrow();
    expect(s.cache.put).not.toHaveBeenCalled();
  });

  it('案内の画面以外をキャッシュに入れない', async () => {
    const s = load();
    s.handlers.install(s.ext());
    s.handlers.fetch(s.ext({ request: { mode: 'navigate' } }));
    s.handlers.fetch(s.ext({ request: { mode: 'cors' } }));
    await Promise.all(s.waits);
    expect(s.cache.put).toHaveBeenCalledTimes(1);
    expect(source.match(/\.put\(/g)).toHaveLength(1);
    expect(source).not.toMatch(/addAll\(|\.add\(/);
  });

  it('有効になるとき、古い名前のキャッシュを消す', async () => {
    const s = load({ existing: ['offline-v0', 'offline-v1'] });
    s.handlers.activate(s.ext());
    await Promise.all(s.waits);
    expect(s.caches.delete).toHaveBeenCalledWith('offline-v0');
    expect(s.caches.delete).not.toHaveBeenCalledWith('offline-v1');
    expect(s.self.clients.claim).toHaveBeenCalled();
  });

  it('ナビゲーション以外のリクエストには respondWith しない', () => {
    const s = load();
    const respondWith = vi.fn();
    s.handlers.fetch({ request: { mode: 'cors' }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  });

  it('サーバーが 500 を返すときは、そのまま返す', async () => {
    const res500 = { status: 500 };
    const s = load({ fetchImpl: () => Promise.resolve(res500) });
    const respondWith = vi.fn();
    s.handlers.fetch({ request: { mode: 'navigate' }, respondWith });
    expect(await respondWith.mock.calls[0][0]).toBe(res500);
    expect(s.caches.match).not.toHaveBeenCalled();
  });

  it('通信の失敗のときだけ案内の画面を返す', async () => {
    const s = load({ fetchImpl: () => Promise.reject(new TypeError('offline')) });
    const respondWith = vi.fn();
    s.handlers.fetch({ request: { mode: 'navigate' }, respondWith });
    expect(await respondWith.mock.calls[0][0]).toBe(s.offlineResponse);
    expect(s.caches.match).toHaveBeenCalledWith('/assets/offline.html');
  });
});
