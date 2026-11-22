import { describe, expect, it } from 'vitest';
import { PHOTO_MS } from './limits';
import {
  initialState,
  reduce,
  zoneOf,
  type StoryLength,
  type ViewerEvent,
  type ViewerState,
} from './viewer-state';

const photo: StoryLength = { type: 'image', durationMs: null };
const video8: StoryLength = { type: 'video', durationMs: 8000 };
const run = (s: ViewerState, list: StoryLength[], ...events: ViewerEvent[]) =>
  events.reduce((acc, e) => reduce(acc, e, list), s);

describe('viewer-state', () => {
  it('写真は 5,000 ms で進み 4,999 ms では進まない', () => {
    const list = [photo, photo];
    const before = run(initialState(), list, { type: 'tick', dtMs: 4999 });
    expect(before.index).toBe(0);
    const after5000 = run(initialState(), list, { type: 'tick', dtMs: PHOTO_MS });
    expect(after5000.index).toBe(1);
    expect(after5000.elapsedMs).toBe(0);
  });

  it('動画は durationMs で進む', () => {
    const list = [video8, photo];
    expect(run(initialState(), list, { type: 'tick', dtMs: 7999 }).index).toBe(0);
    expect(run(initialState(), list, { type: 'tick', dtMs: 8000 }).index).toBe(1);
  });

  it('前後の移動と、端での振る舞い', () => {
    const list = [photo, photo, photo];
    const at1 = initialState(1);
    expect(run(at1, list, { type: 'pressEnd', heldMs: 50, zone: 'prev' }).index).toBe(0);
    expect(run(at1, list, { type: 'pressEnd', heldMs: 50, zone: 'next' }).index).toBe(2);
    expect(run(at1, list, { type: 'prev' }).index).toBe(0);
    expect(run(at1, list, { type: 'next' }).index).toBe(2);
    // the first story: prev does nothing (not even a restart of its time)
    const first = run(initialState(), list, { type: 'tick', dtMs: 1000 });
    expect(run(first, list, { type: 'prev' })).toEqual(first);
    // the last story: next asks for the next person
    const last = initialState(2);
    expect(run(last, list, { type: 'next' }).done).toBe('next-user');
    expect(run(last, list, { type: 'tick', dtMs: PHOTO_MS }).done).toBe('next-user');
    expect(run(last, list, { type: 'tick', dtMs: 10 }).done).toBeUndefined();
  });

  it('200 ms 以上の長押しで止まり、離すと残りの時間から再開する', () => {
    const list = [photo, photo];
    let s = run(initialState(), list, { type: 'tick', dtMs: 2000 });
    s = run(s, list, { type: 'pressStart' }, { type: 'tick', dtMs: 10_000 });
    expect(s).toMatchObject({ index: 0, elapsedMs: 2000, held: true });
    s = run(s, list, { type: 'pressEnd', heldMs: 200, zone: 'next' });
    expect(s).toMatchObject({ index: 0, elapsedMs: 2000, held: false });
    expect(run(s, list, { type: 'tick', dtMs: 2999 }).index).toBe(0);
    expect(run(s, list, { type: 'tick', dtMs: 3000 }).index).toBe(1);
    // 199 ms is a tap
    const tap = run(run(initialState(), list, { type: 'pressStart' }), list, {
      type: 'pressEnd',
      heldMs: 199,
      zone: 'next',
    });
    expect(tap.index).toBe(1);
  });

  it('一時停止と読み込みの失敗の間は進まず、移動で失敗が解ける', () => {
    const list = [photo, photo];
    const paused = run(
      initialState(),
      list,
      { type: 'setPaused', paused: true },
      { type: 'tick', dtMs: 9000 },
    );
    expect(paused.index).toBe(0);
    const failed = run(initialState(), list, { type: 'fail' }, { type: 'tick', dtMs: 9000 });
    expect(failed).toMatchObject({ index: 0, failed: true });
    expect(run(failed, list, { type: 'next' })).toMatchObject({ index: 1, failed: false });
  });

  it('左 1/3 は前、右 2/3 は次', () => {
    expect(zoneOf(0, 300)).toBe('prev');
    expect(zoneOf(99, 300)).toBe('prev');
    expect(zoneOf(100, 300)).toBe('next');
    expect(zoneOf(299, 300)).toBe('next');
  });
});
