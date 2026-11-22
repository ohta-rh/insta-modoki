'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useSyncExternalStore,
  type PointerEvent,
} from 'react';
import { trapTab } from '../../../shared/ui/focus-trap';
import { markStoryViewedAction } from '../api/actions';
import type { StoryReel } from '../api/get-story-reel';
import { VIDEO_UNREADABLE } from '../model/limits';
import { nextFromQueue } from '../model/story-queue';
import {
  HOLD_MS,
  initialState,
  reduce,
  zoneOf,
  type StoryLength,
  type ViewerEvent,
  type ViewerState,
} from '../model/viewer-state';
import { StoryProgress } from './StoryProgress';
import { ViewerListSheet } from './ViewerListSheet';

const REDUCED = '(prefers-reduced-motion: reduce)';
const SWIPE_CLOSE_PX = 80;
/** A press that moves farther than this is a drag, never a tap. */
const DRAG_PX = 10;
/** A frame gap longer than this (a hidden tab) must not skip a story. */
const MAX_FRAME_MS = 250;

const subscribeReduced = (callback: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
};

const BUTTON =
  'flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center rounded-lg bg-black/60 px-3 text-[length:var(--font-size-sm)] font-bold text-white';

/**
 * The story viewer: a full-screen dialog that walks through one person's stories on a clock
 * (5 s a photo, the video's length for a video). Tap the left third to go back and the rest to go
 * on, hold to pause, swipe down or Esc to close, ← / → for the keys. In `modal` mode it sits over
 * the page it was opened from (an intercepting route, ADR-0043) and closing is one step back; in
 * `page` mode (a direct load) closing goes home. Past the last story it moves to the next person
 * (the saved tray order when the person is in it, else the server's) without adding history.
 */
export function StoryViewer({ reel, mode }: { reel: StoryReel; mode: 'modal' | 'page' }) {
  const router = useRouter();
  const lengths: StoryLength[] = reel.stories;
  const [state, dispatch] = useReducer(
    (s: ViewerState, e: ViewerEvent) => reduce(s, e, lengths),
    reel.startIndex,
    initialState,
  );
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
  const root = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const leaving = useRef(false);
  const closedByUser = useRef(false);
  const press = useRef<{
    startedAt: number;
    x: number;
    y: number;
    moved: boolean;
    closed: boolean;
    zone: 'prev' | 'next';
  } | null>(null);

  const story = reel.stories[state.index]!;
  const username = reel.user.username;
  const label = `${username}のストーリー`;

  const close = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    closedByUser.current = true;
    if (mode === 'modal') router.back();
    else router.replace('/');
  }, [mode, router]);

  // The home's server parts (the tray) were drawn before the views were recorded. Refresh once the
  // viewer has gone, i.e. once the URL is the home's: a refresh issued right after `back()` would
  // still target the viewer's URL and leave the cached home as it was.
  useEffect(
    () => () => {
      if (closedByUser.current) router.refresh();
    },
    [router],
  );

  // The clock: the time between frames is what the reducer counts (not run under "reduce motion").
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let last: number | null = null;
    const step = (now: number) => {
      if (last !== null) dispatch({ type: 'tick', dtMs: Math.min(now - last, MAX_FRAME_MS) });
      last = now;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  // Past the last story: on to the next person, else close.
  useEffect(() => {
    if (state.done !== 'next-user' || leaving.current) return;
    const queued = nextFromQueue(username);
    const next = queued.inQueue ? queued.next : reel.nextUsername;
    if (!next) {
      close();
      return;
    }
    leaving.current = true;
    router.replace(`/stories/${next}`, { scroll: false });
  }, [state.done, username, reel.nextUsername, close, router]);

  // Every story shown is recorded as viewed (the author's own makes no row, so it is not sent).
  useEffect(() => {
    if (reel.isMe) return;
    void markStoryViewedAction({ storyId: story.id }).catch(() => undefined);
  }, [story.id, reel.isMe]);

  // A video follows the pause; a video whose file failed before hydration is found here too.
  const stopped = state.paused || state.held || state.failed;
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (stopped) el.pause();
    else void el.play().catch(() => undefined);
  }, [stopped, story.id]);
  useEffect(() => {
    const el = video.current;
    if (el && el.error) dispatch({ type: 'fail' });
  }, [story.id]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    const nestedOpen = () => root.current?.querySelector('dialog[open]') != null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || nestedOpen()) return; // the viewers sheet handles its own keys
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowLeft') {
        dispatch({ type: 'prev' });
      } else if (e.key === 'ArrowRight') {
        dispatch({ type: 'next' });
      } else if (root.current) {
        trapTab(e, root.current);
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (root.current && e.target instanceof Node && !root.current.contains(e.target)) {
        closeButton.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = previous;
      // Back to the tray item that opened it, unless the focus already went somewhere else.
      const active = document.activeElement;
      if (!active || active === document.body) {
        const tray = document.querySelector('[data-testid="story-tray"]');
        const opener =
          tray?.querySelector<HTMLElement>(`a[href="/stories/${username}"]`) ??
          tray?.querySelector<HTMLElement>('a[href="/stories/create"]');
        opener?.focus({ preventScroll: true });
      }
    };
  }, [close, username]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    press.current = {
      startedAt: performance.now(),
      x: e.clientX,
      y: e.clientY,
      moved: false,
      closed: false,
      zone: zoneOf(e.clientX - rect.left, rect.width),
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A synthetic pointer has nothing to capture; the press still works.
    }
    dispatch({ type: 'pressStart' });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.closed) return;
    const dy = e.clientY - p.y;
    if (Math.abs(e.clientX - p.x) > DRAG_PX || Math.abs(dy) > DRAG_PX) p.moved = true;
    if (dy >= SWIPE_CLOSE_PX) {
      p.closed = true;
      close();
    }
  };
  const onPointerUp = () => {
    const p = press.current;
    press.current = null;
    if (!p || p.closed) return;
    const heldMs = p.moved ? HOLD_MS : performance.now() - p.startedAt;
    dispatch({ type: 'pressEnd', heldMs, zone: p.zone });
  };
  const onPointerCancel = () => {
    const p = press.current;
    press.current = null;
    if (p) dispatch({ type: 'pressEnd', heldMs: HOLD_MS, zone: p.zone });
  };

  const alt = story.altText || label;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      data-testid="story-viewer-backdrop"
    >
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-testid="story-viewer"
        className="relative h-full w-full overflow-hidden bg-black text-white md:aspect-[9/16] md:h-[min(100vh,900px)] md:w-auto"
      >
        <div
          data-testid="story-surface"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 touch-none select-none"
        >
          {story.type === 'video' && story.videoUrl ? (
            <video
              key={story.id}
              ref={video}
              src={story.videoUrl}
              muted
              playsInline
              autoPlay
              preload="auto"
              onError={() => dispatch({ type: 'fail' })}
              className="h-full w-full object-contain"
            />
          ) : story.srcset ? (
            <img
              key={story.id}
              src={story.srcset.w1080}
              srcSet={`${story.srcset.w320} 320w, ${story.srcset.w640} 640w, ${story.srcset.w1080} 1080w`}
              sizes="100vw"
              alt={alt}
              width={story.width}
              height={story.height}
              draggable={false}
              className="h-full w-full object-contain"
            />
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent pb-4">
          <StoryProgress stories={lengths} index={state.index} elapsedMs={state.elapsedMs} />
          <div className="pointer-events-auto mt-2 flex items-center gap-2 px-2">
            {reel.user.avatarUrl ? (
              <img
                src={reel.user.avatarUrl}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : null}
            <span className="min-w-0 flex-1 truncate text-[length:var(--font-size-sm)] font-bold">
              {username}
            </span>
            <button
              type="button"
              onClick={() => dispatch({ type: 'setPaused', paused: !state.paused })}
              className={BUTTON}
            >
              {state.paused ? '再生' : '一時停止'}
            </button>
            <button ref={closeButton} type="button" onClick={close} className={BUTTON}>
              閉じる
            </button>
          </div>
        </div>

        <button
          type="button"
          aria-label="前へ"
          onClick={() => dispatch({ type: 'prev' })}
          className={`${BUTTON} absolute left-1 top-1/2 -translate-y-1/2`}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          aria-label="次へ"
          onClick={() => dispatch({ type: 'next' })}
          className={`${BUTTON} absolute right-1 top-1/2 -translate-y-1/2`}
        >
          <span aria-hidden="true">›</span>
        </button>

        {state.failed ? (
          <p
            role="alert"
            className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-lg bg-black/80 p-3 text-center font-bold"
          >
            {VIDEO_UNREADABLE}
          </p>
        ) : null}

        {reel.isMe ? (
          <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/60 to-transparent p-3">
            <ViewerListSheet
              key={story.id}
              storyId={story.id}
              count={story.viewerCount ?? 0}
              onOpenChange={(open) => dispatch({ type: 'setPaused', paused: open })}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
