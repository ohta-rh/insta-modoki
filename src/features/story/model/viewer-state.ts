import { PHOTO_MS } from './limits';

export type StoryLength = { type: 'image' | 'video'; durationMs: number | null };
export type ViewerState = {
  index: number;
  elapsedMs: number;
  /** Paused from outside (the viewers sheet is open, or the pause button). */
  paused: boolean;
  /** A finger or button is down on the screen. */
  held: boolean;
  /** The video could not be read; time does not run until the viewer moves on. */
  failed: boolean;
  /** Set when "next" was asked on the last story: the viewer must go to the next person. */
  done?: 'next-user';
};
export type ViewerEvent =
  | { type: 'tick'; dtMs: number }
  | { type: 'pressStart' }
  | { type: 'pressEnd'; heldMs: number; zone: 'prev' | 'next' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'fail' }
  | { type: 'setPaused'; paused: boolean };

/** A press this long or longer is a hold (pause and resume), shorter is a tap. */
export const HOLD_MS = 200;

export const initialState = (startIndex = 0): ViewerState => ({
  index: startIndex,
  elapsedMs: 0,
  paused: false,
  held: false,
  failed: false,
});

/** How long one story is shown: a photo `PHOTO_MS`, a video its own length. */
export const lengthOf = (story: StoryLength): number =>
  story.type === 'video' && story.durationMs ? story.durationMs : PHOTO_MS;

/** Left third goes back, the rest goes on. */
export const zoneOf = (x: number, width: number): 'prev' | 'next' =>
  x < width / 3 ? 'prev' : 'next';

const go = (state: ViewerState, index: number): ViewerState => ({
  ...state,
  index,
  elapsedMs: 0,
  failed: false,
  done: undefined,
});

function next(state: ViewerState, count: number): ViewerState {
  if (state.index >= count - 1) return { ...state, done: 'next-user' };
  return go(state, state.index + 1);
}

function prev(state: ViewerState): ViewerState {
  return state.index === 0 ? state : go(state, state.index - 1);
}

/** The whole behaviour of the viewer's clock and moves; pure so every edge is testable. */
export function reduce(
  state: ViewerState,
  event: ViewerEvent,
  stories: StoryLength[],
): ViewerState {
  switch (event.type) {
    case 'tick': {
      if (state.paused || state.held || state.failed || state.done) return state;
      const current = stories[state.index];
      if (!current) return state;
      const elapsedMs = state.elapsedMs + event.dtMs;
      return elapsedMs >= lengthOf(current) ? next(state, stories.length) : { ...state, elapsedMs };
    }
    case 'pressStart':
      return { ...state, held: true };
    case 'pressEnd': {
      const released = { ...state, held: false };
      if (event.heldMs >= HOLD_MS) return released;
      return event.zone === 'prev' ? prev(released) : next(released, stories.length);
    }
    case 'next':
      return next(state, stories.length);
    case 'prev':
      return prev(state);
    case 'fail':
      return { ...state, failed: true };
    case 'setPaused':
      return { ...state, paused: event.paused };
  }
}
