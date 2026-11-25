import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openUnreadStream } from './unread-stream';

class FakeSource {
  static all: FakeSource[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  private listeners = new Map<string, (e: { data: string }) => void>();
  constructor(public url: string) {
    FakeSource.all.push(this);
  }
  addEventListener(type: string, l: (e: { data: string }) => void) {
    this.listeners.set(type, l);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  emit(type: string, data: string) {
    this.listeners.get(type)?.({ data });
  }
}

const hooks = () => ({ onCount: vi.fn(), onOpen: vi.fn(), onDown: vi.fn() });
const create = (url: string) => new FakeSource(url) as unknown as EventSource;

beforeEach(() => {
  FakeSource.all = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('openUnreadStream', () => {
  it('同じ origin の配信へつなぎ、unread の数と開閉を知らせる', () => {
    const h = hooks();
    openUnreadStream(h, create);
    const s = FakeSource.all[0]!;
    expect(s.url).toBe('/api/notifications/stream');
    s.onopen!();
    expect(h.onOpen).toHaveBeenCalledTimes(1);
    s.emit('unread', '{"unreadCount":4}');
    expect(h.onCount).toHaveBeenCalledWith(4);
    s.emit('unread', '{"unreadCount":-1}');
    s.emit('unread', 'garbage');
    expect(h.onCount).toHaveBeenCalledTimes(1);
    s.readyState = 0; // the browser reconnects by itself
    s.onerror!();
    expect(h.onDown).toHaveBeenCalledTimes(1);
    expect(FakeSource.all).toHaveLength(1);
  });

  it('ブラウザが諦めたら 1 秒、2 秒、4 秒、10 秒の間隔で作り直し、つながったら戻す', () => {
    const h = hooks();
    openUnreadStream(h, create);
    for (const wait of [1000, 2000, 4000, 10000, 10000]) {
      const before = FakeSource.all.length;
      const s = FakeSource.all[before - 1]!;
      s.readyState = 2;
      s.onerror!();
      vi.advanceTimersByTime(wait - 1);
      expect(FakeSource.all).toHaveLength(before);
      vi.advanceTimersByTime(1);
      expect(FakeSource.all).toHaveLength(before + 1);
    }
    // A delivered event resets the back-off.
    FakeSource.all.at(-1)!.emit('unread', '{"unreadCount":1}');
    FakeSource.all.at(-1)!.readyState = 2;
    FakeSource.all.at(-1)!.onerror!();
    vi.advanceTimersByTime(1000);
    expect(FakeSource.all).toHaveLength(7);
  });

  it('閉じたら接続を閉じ、作り直しも止める', () => {
    const h = hooks();
    const close = openUnreadStream(h, create);
    const s = FakeSource.all[0]!;
    s.readyState = 2;
    s.onerror!();
    close();
    vi.advanceTimersByTime(60_000);
    expect(FakeSource.all).toHaveLength(1);
    expect(s.closed).toBe(true);
  });
});
