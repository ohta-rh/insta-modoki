'use client';

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { HeartFilledIcon } from '../../../shared/ui/icons';
import { isDoubleTap } from '../model/double-tap';
import { useLikeScope } from './LikeScope';

/**
 * The heart that flashes over the photo after a double tap. With "reduce motion" nothing moves:
 * the element is not rendered at all and only the like state changes.
 */
export function LikeBurst({ reduceMotion }: { reduceMotion: boolean }) {
  if (reduceMotion) return null;
  return (
    <span
      data-testid="like-burst"
      aria-hidden="true"
      className="like-burst pointer-events-none absolute inset-0 flex items-center justify-center text-white drop-shadow-lg"
    >
      <HeartFilledIcon size={96} />
    </span>
  );
}

const BURST_MS = 800;

/**
 * Wraps the photos: a second tap (double click on a desktop) within 300 ms likes the post. It never
 * unlikes: a post that is already liked stays liked. Taps on buttons and links inside (the
 * carousel arrows) are not counted.
 */
export function DoubleTapLike({ children }: { children: ReactNode }) {
  const { like } = useLikeScope();
  const lastTap = useRef<number | null>(null);
  const [burst, setBurst] = useState<{ key: number; reduceMotion: boolean } | null>(null);

  useEffect(() => {
    if (!burst) return;
    const timer = setTimeout(() => setBurst(null), BURST_MS);
    return () => clearTimeout(timer);
  }, [burst]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('button, a, input')) return;
    const now = Date.now();
    if (!isDoubleTap(lastTap.current, now)) {
      lastTap.current = now;
      return;
    }
    lastTap.current = null;
    like();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setBurst((b) => ({ key: (b?.key ?? 0) + 1, reduceMotion }));
  };

  return (
    <div className="relative touch-manipulation" onClick={onClick}>
      {children}
      {burst && <LikeBurst key={burst.key} reduceMotion={burst.reduceMotion} />}
    </div>
  );
}
