import { getUnreadNotificationCountAction } from '../api/actions';

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
};

/**
 * The one place the unread count lives in the browser, shaped for `useSyncExternalStore`. While at
 * least one component is subscribed (the side and the bottom navigation both are) it asks the
 * server once every `intervalMs`, however many subscribers there are. It does not ask while the
 * tab is hidden and asks once as soon as it is shown. A failed ask (a result with `ok: false`, or
 * a thrown error) changes nothing and shows nothing: the number stays and the next ask comes on
 * schedule. #58 replaces only how the number is fetched.
 */
export function createUnreadStore({ fetchCount, doc, intervalMs }: UnreadStoreOptions) {
  let count = 0;
  let version = 0;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;

  const emit = () => listeners.forEach((l) => l());
  const apply = (next: number) => {
    version += 1;
    if (next === count) return;
    count = next;
    emit();
  };

  async function poll() {
    if (doc.hidden || inFlight) return;
    inFlight = true;
    const started = version;
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
      inFlight = false;
    }
  }

  const onVisibility = () => {
    if (!doc.hidden) void poll();
  };

  function start() {
    doc.addEventListener('visibilitychange', onVisibility);
    void poll();
    timer = setInterval(() => void poll(), intervalMs);
  }
  function stop() {
    doc.removeEventListener('visibilitychange', onVisibility);
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  return {
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
});
