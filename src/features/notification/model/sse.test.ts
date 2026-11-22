import { describe, expect, it } from 'vitest';
import {
  encodeUnreadEvent,
  parseUnreadEvent,
  PING_LINE,
  reconnectDelay,
  STREAM_PING_MS,
  STREAM_RETRY_MS,
  STREAM_TICK_MS,
  STREAM_WINDOW_MS,
} from './sse';

describe('notification SSE の純粋な部分', () => {
  it('定数と印の行と、イベントの書き方', () => {
    expect([STREAM_TICK_MS, STREAM_PING_MS, STREAM_WINDOW_MS, STREAM_RETRY_MS]).toEqual([
      3000, 15000, 60000, 1000,
    ]);
    expect(PING_LINE).toBe(': ping\n\n');
    expect(encodeUnreadEvent(7)).toBe('event: unread\ndata: {"unreadCount":7}\n\n');
  });

  it('parseUnreadEvent は 0〜100 の整数だけを数として読む', () => {
    expect(parseUnreadEvent('{"unreadCount":0}')).toBe(0);
    expect(parseUnreadEvent('{"unreadCount":100}')).toBe(100);
    for (const bad of [
      '{"unreadCount":-1}',
      '{"unreadCount":101}',
      '{"unreadCount":1.5}',
      '{"unreadCount":"3"}',
      '{}',
      'null',
      'not json',
      '',
    ]) {
      expect(parseUnreadEvent(bad)).toBeNull();
    }
  });

  it('reconnectDelay は 1,000 → 2,000 → 4,000 → 以降 10,000', () => {
    expect([0, 1, 2, 3, 4, 50].map(reconnectDelay)).toEqual([
      1000, 2000, 4000, 10000, 10000, 10000,
    ]);
  });
});
