import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnreadStore } from './unread-store';

type Fetched = { ok: true; data: { count: number } } | { ok: false };

function setup(initial: Fetched[] = []) {
  const answers = [...initial];
  const fetchCount = vi.fn(
    async (): Promise<Fetched> => answers.shift() ?? { ok: true, data: { count: 0 } },
  );
  const listeners = new Set<() => void>();
  const doc = {
    hidden: false,
    addEventListener: (_: 'visibilitychange', l: () => void) => void listeners.add(l),
    removeEventListener: (_: 'visibilitychange', l: () => void) => void listeners.delete(l),
  };
  const store = createUnreadStore({ fetchCount: fetchCount as never, doc, intervalMs: 10_000 });
  const show = () => {
    doc.hidden = false;
    listeners.forEach((l) => l());
  };
  return { store, fetchCount, doc, show, answers };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('unreadStore', () => {
  it('失敗しても直前の数を保ち、隠れている間は取得を止める', async () => {
    const { store, fetchCount, doc, show } = setup([
      { ok: true, data: { count: 3 } },
      { ok: false },
      { ok: true, data: { count: 5 } },
    ]);
    const seen: number[] = [];
    const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot()));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot()).toBe(3);

    // One failure: the number stays and the next try is 10,000 ms later.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchCount).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot()).toBe(3);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(fetchCount).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchCount).toHaveBeenCalledTimes(3);
    expect(store.getSnapshot()).toBe(5);

    // Hidden: no fetch; shown again: one fetch at once.
    doc.hidden = true;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchCount).toHaveBeenCalledTimes(3);
    show();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchCount).toHaveBeenCalledTimes(4);
    unsubscribe();
  });

  it('例外も無視して直前の数を保つ', async () => {
    const { store, fetchCount } = setup([{ ok: true, data: { count: 2 } }]);
    fetchCount.mockRejectedValueOnce(new Error('offline'));
    store.set(2);
    store.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot()).toBe(2);
  });

  it('購読者が 2 つでも取得は 1 回', async () => {
    const { store, fetchCount } = setup([{ ok: true, data: { count: 1 } }]);
    const a = store.subscribe(() => {});
    const b = store.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchCount).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchCount).toHaveBeenCalledTimes(2);
    a();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchCount).toHaveBeenCalledTimes(3);
    b();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchCount).toHaveBeenCalledTimes(3);
  });

  it('set で数を変えて購読者に知らせ、それより前に始めた取得の結果は捨てる', async () => {
    let release!: (v: Fetched) => void;
    const fetchCount = vi.fn(() => new Promise<Fetched>((r) => (release = r)));
    const store = createUnreadStore({
      fetchCount: fetchCount as never,
      doc: { hidden: false, addEventListener() {}, removeEventListener() {} },
      intervalMs: 10_000,
    });
    const seen: number[] = [];
    store.subscribe(() => seen.push(store.getSnapshot()));
    await vi.advanceTimersByTimeAsync(0);
    store.set(0);
    release({ ok: true, data: { count: 4 } });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot()).toBe(0);
    expect(seen).toEqual([]);
  });
});

describe('unreadStore の利用者の切り替え', () => {
  it('利用者が変わったら前の人の数を消し、前の人のために始めた取得の結果は捨てる', async () => {
    const resolvers: Array<(v: Fetched) => void> = [];
    const fetchCount = vi.fn(() => new Promise<Fetched>((r) => void resolvers.push(r)));
    const store = createUnreadStore({
      fetchCount: fetchCount as never,
      doc: { hidden: false, addEventListener() {}, removeEventListener() {} },
      intervalMs: 10_000,
    });
    store.setViewer('a');
    const seen: number[] = [];
    store.subscribe(() => seen.push(store.getSnapshot()));
    await vi.advanceTimersByTimeAsync(0);
    resolvers[0]!({ ok: true, data: { count: 5 } });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot()).toBe(5);
    expect(store.getSnapshotFor('a')).toBe(5);

    // The next ask is out for A when B signs in on the same tab.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchCount).toHaveBeenCalledTimes(2);
    store.setViewer('b');
    expect(store.getSnapshot()).toBe(0);
    expect(store.getSnapshotFor('b')).toBe(0);
    // Before the store knows the new person, a render for B never shows A's number.
    expect(store.getSnapshotFor('c')).toBe(0);

    resolvers[1]!({ ok: true, data: { count: 7 } });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot()).toBe(0);

    // B's own ask starts at once and its answer is shown.
    expect(fetchCount).toHaveBeenCalledTimes(3);
    resolvers[2]!({ ok: true, data: { count: 1 } });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot()).toBe(1);
    expect(seen).toContain(0);
  });
});
