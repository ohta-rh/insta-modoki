import { getUnreadNotificationCountAction } from '../api/actions';
import { openUnreadStream, type UnreadStreamHooks } from './unread-stream';

type CountResult = { ok: true; data: { count: number } } | { ok: false };
type VisibilityDoc = {
  hidden: boolean;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
};

export type UnreadStoreOptions = {
  fetchCount: () => Promise<CountResult>;
  doc: VisibilityDoc;
  intervalMs: number;
  /** Opens the push stream and returns its closer. Without it the store only polls. */
  openStream?: (hooks: UnreadStreamHooks) => () => void;
};

/**
 * The one place the unread count lives in the browser, shaped for `useSyncExternalStore`. While at
 * least one component is subscribed (the side and the bottom navigation both are) it asks the
 * server once every `intervalMs`, however many subscribers there are. It does not ask while the
 * tab is hidden and asks once as soon as it is shown. A failed ask (a result with `ok: false`, or
 * a thrown error) changes nothing and shows nothing: the number stays and the next ask comes on
 * schedule. With `openStream` (ADR-0050) the count is pushed instead: while the stream is open
 * there is no polling, and while it is down (not yet open, or dropped and being re-opened by the
 * browser) the polling above is the fallback. A hidden tab closes the stream and shows it again
 * with a new one, whose first event is the current count.
 */
export function createUnreadStore({ fetchCount, doc, intervalMs, openStream }: UnreadStoreOptions) {
  let count = 0;
  let version = 0;
  let viewer: string | null = null;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: number | null = null;

  const emit = () => listeners.forEach((l) => l());
  const apply = (next: number) => {
    version += 1;
    if (next === count) return;
    count = next;
    emit();
  };

  async function poll() {
    if (doc.hidden || inFlight === version) return;
    const started = version;
    inFlight = started;
    try {
      const result = await fetchCount();
      // A set() made while the ask was out is newer than its answer.
      if (result.ok && started === version) {
        if (result.data.count !== count) {
          count = result.data.count;
          emit();
        }
      }
    } catch {
      // keep the previous number
    } finally {
      if (inFlight === started) inFlight = null;
    }
  }

  let closeStream: (() => void) | null = null;
  let everOpen = false;

  function startPolling(now: boolean) {
    if (timer === null) timer = setInterval(() => void poll(), intervalMs);
    if (now) void poll();
  }
  function stopPolling() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }
  function connect() {
    if (!openStream || closeStream || doc.hidden) return;
    everOpen = false;
    closeStream = openStream({
      onCount: apply,
      onOpen: () => {
        everOpen = true;
        stopPolling();
      },
      // The first drop before any success asks at once; later drops (the 60 s turnover) wait a period.
      onDown: () => {
        if (timer === null) startPolling(!everOpen);
      },
    });
  }
  function disconnect() {
    closeStream?.();
    closeStream = null;
    stopPolling();
  }

  const onVisibility = () => {
    if (!openStream) return void (!doc.hidden && poll());
    if (doc.hidden) disconnect();
    else connect();
  };

  function start() {
    doc.addEventListener('visibilitychange', onVisibility);
    if (openStream) return connect();
    void poll();
    startPolling(false);
  }
  function stop() {
    doc.removeEventListener('visibilitychange', onVisibility);
    disconnect();
    // Nobody shows the count any more (the signed-in user left): do not keep it for the next one.
    version += 1;
    count = 0;
  }

  /**
   * Tells the store whose count it holds. When the person changes (a log-out and a log-in are client
   * navigations, so this module outlives them) the count goes back to 0 and an ask still out for
   * the previous person is dropped; the new person's own ask starts at once.
   */
  function setViewer(next: string | null) {
    if (next === viewer) return;
    const previous = viewer;
    viewer = next;
    // The first person the store is told about changes nothing: no earlier person's count or ask exists.
    if (previous === null) return;
    version += 1;
    const had = count !== 0;
    count = 0;
    if (had) emit();
    if (listeners.size === 0) return;
    if (openStream) {
      disconnect();
      connect();
    } else void poll();
  }

  return {
    setViewer,
    /** The count for `forViewer`: 0 until the store has been told that person (never a previous one's). */
    getSnapshotFor: (forViewer: string | null): number => (forViewer === viewer ? count : 0),
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    getSnapshot: (): number => count,
    set: apply,
  };
}

export const UNREAD_POLL_MS = 10_000;

/** The store the navigation reads; it asks the server through the Server Action. */
export const unreadStore = createUnreadStore({
  fetchCount: () => getUnreadNotificationCountAction(),
  doc:
    typeof document === 'undefined'
      ? { hidden: true, addEventListener() {}, removeEventListener() {} }
      : document,
  intervalMs: UNREAD_POLL_MS,
  openStream: typeof EventSource === 'undefined' ? undefined : openUnreadStream,
});
