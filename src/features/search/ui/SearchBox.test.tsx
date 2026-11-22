import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSearchController, type SearchResponse } from '../model/search-controller';

const row = (username: string) => ({ username, displayName: username, avatarUrl: null });

/** A search() whose answers the test settles by hand, in any order. */
function manualSearch() {
  const calls: string[] = [];
  const settlers: Array<(r: SearchResponse) => void> = [];
  const search = (q: string) =>
    new Promise<SearchResponse>((resolve) => {
      calls.push(q);
      settlers.push(resolve);
    });
  return { search, calls, settle: (i: number, r: SearchResponse) => settlers[i]!(r) };
}
const ok = (...names: string[]): SearchResponse => ({
  ok: true,
  data: { items: names.map(row) },
});
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SearchBox', () => {
  it('250 ms の間引きで 1 回だけ呼び、古い応答を捨てる', async () => {
    const server = manualSearch();
    const c = createSearchController({ search: server.search, onChange: () => {} });
    c.input('h');
    await vi.advanceTimersByTimeAsync(100);
    c.input('ha');
    await vi.advanceTimersByTimeAsync(100);
    c.input('har');
    await vi.advanceTimersByTimeAsync(249);
    expect(server.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.calls).toEqual(['har']);

    // A slower, older call answers after a newer one: it must not replace the newer result.
    c.input('haru');
    await vi.advanceTimersByTimeAsync(250);
    expect(server.calls).toEqual(['har', 'haru']);
    server.settle(1, ok('haru'));
    await flush();
    server.settle(0, ok('harold', 'harry'));
    await flush();
    expect(c.snapshot()).toMatchObject({ text: 'haru', answered: 'haru', error: null });
    expect(c.snapshot().items.map((i) => i.username)).toEqual(['haru']);
  });

  it('空の入力は呼ばず、返ってくる応答も捨てて候補を空にする', async () => {
    const server = manualSearch();
    const c = createSearchController({ search: server.search, onChange: () => {} });
    c.input('ha');
    await vi.advanceTimersByTimeAsync(250);
    c.input('  ');
    server.settle(0, ok('haru'));
    await flush();
    await vi.advanceTimersByTimeAsync(500);
    expect(server.calls).toEqual(['ha']);
    expect(c.snapshot()).toMatchObject({ text: '  ', answered: null, items: [], error: null });
  });

  it('失敗した応答の message を警告に出す', async () => {
    const server = manualSearch();
    const seen: Array<string | null> = [];
    const c = createSearchController({
      search: server.search,
      onChange: (s) => seen.push(s.error),
    });
    c.input('ha');
    await vi.advanceTimersByTimeAsync(250);
    server.settle(0, {
      ok: false,
      error: { message: '操作が多すぎます。しばらくしてからもう一度お試しください' },
    });
    await flush();
    expect(c.snapshot()).toMatchObject({
      text: 'ha',
      error: '操作が多すぎます。しばらくしてからもう一度お試しください',
    });

    // The next successful answer clears it.
    c.input('har');
    await vi.advanceTimersByTimeAsync(250);
    server.settle(1, ok('haru'));
    await flush();
    expect(c.snapshot().error).toBeNull();
  });

  it('通信そのものの失敗は定型の文言を出し、入力は残す', async () => {
    const c = createSearchController({
      search: () => Promise.reject(new Error('network')),
      onChange: () => {},
    });
    c.input('ha');
    await vi.advanceTimersByTimeAsync(250);
    expect(c.snapshot()).toMatchObject({
      text: 'ha',
      error: '検索できませんでした。もう一度お試しください',
    });
  });
});
