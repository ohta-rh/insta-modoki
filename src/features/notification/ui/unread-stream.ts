import { parseUnreadEvent, reconnectDelay } from '../model/sse';

export type UnreadStreamHooks = {
  onCount: (count: number) => void;
  onOpen: () => void;
  onDown: () => void;
};

/**
 * Listens to `/api/notifications/stream` (ADR-0050) and returns a function that closes it. The
 * browser re-opens a connection the server ended or the network dropped; when it gives up (the
 * server answered 401, say) this makes a new one after `reconnectDelay`.
 */
export function openUnreadStream(
  { onCount, onOpen, onDown }: UnreadStreamHooks,
  create: (url: string) => EventSource = (url) => new EventSource(url),
): () => void {
  let source: EventSource;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  const connect = () => {
    source = create('/api/notifications/stream');
    source.onopen = () => {
      attempt = 0;
      onOpen();
    };
    source.addEventListener('unread', (e) => {
      const count = parseUnreadEvent((e as MessageEvent<string>).data);
      if (count !== null) {
        attempt = 0;
        onCount(count);
      }
    });
    source.onerror = () => {
      onDown();
      if (source.readyState === 2) {
        source.close();
        timer = setTimeout(connect, reconnectDelay(attempt++));
      }
    };
  };
  connect();
  return () => {
    clearTimeout(timer);
    source.close();
  };
}
