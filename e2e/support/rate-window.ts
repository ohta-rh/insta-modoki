import { expect } from '@playwright/test';

/**
 * Rate limits count in fixed windows that start at `now` floored to `windowSec` (conventions.md
 * "上限とレート制限"). A test that sends several counted requests across a window boundary sees
 * the count reset. The app and the test share one machine clock, so the test can wait out the
 * end of a window before its first counted request.
 */

/** Milliseconds to wait for a window with at least `needSec` seconds left; 0 when it has them. */
export function msUntilFreshWindow(nowMs: number, windowSec: number, needSec: number): number {
  const windowMs = windowSec * 1000;
  const remainingMs = windowMs - (nowMs % windowMs);
  return remainingMs >= needSec * 1000 ? 0 : remainingMs;
}

/** Returns once the current window has at least `needSec` seconds left; waits at most `needSec + 5` s. */
export async function startInFreshWindow(windowSec: number, needSec: number): Promise<void> {
  if (msUntilFreshWindow(Date.now(), windowSec, needSec) === 0) return;
  const windowIndex = () => Math.floor(Date.now() / (windowSec * 1000));
  const current = windowIndex();
  await expect.poll(() => windowIndex() > current, { timeout: needSec * 1000 + 5000 }).toBe(true);
}

/** Returns once the wall clock's second within the minute equals `second` (0-59). */
export async function waitUntilSecondOfMinute(second: number): Promise<void> {
  await expect
    .poll(() => new Date().getUTCSeconds(), { timeout: 65_000, intervals: [50] })
    .toBe(second);
}

/**
 * Last octet (1-250) of the private IP 198.51.100.x one login test counts under. Test 0 uses
 * 1-125 and test 1 uses 126-250, so two tests never share a counter even when they start on
 * opposite sides of a minute boundary; the repeat index and the minute keep runs apart.
 */
export function ownIpLastOctet(testNo: 0 | 1, repeatEachIndex: number, minute: number): number {
  return 1 + testNo * 125 + ((repeatEachIndex + minute) % 125);
}
