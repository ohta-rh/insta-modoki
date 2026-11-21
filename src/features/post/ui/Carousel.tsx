'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import type { MediaView } from '../model/schema';
import { MediaImage } from './MediaImage';

const arrowButton =
  'absolute top-1/2 flex h-[var(--tap-min)] w-[var(--tap-min)] -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white aria-disabled:opacity-0';

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === 'left' ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'} />
    </svg>
  );
}

/**
 * A post's photos side by side, one at a time (scroll-snap). Swipe, the arrow keys on the focused
 * strip and the previous / next buttons all move it; the badge and dots show the position. A post
 * with one photo has no strip, badge, dots or buttons.
 */
export function Carousel({
  media,
  username,
  priority = false,
}: {
  media: MediaView[];
  username: string;
  priority?: boolean;
}) {
  const strip = useRef<HTMLDivElement>(null);
  /** The index a button or key is scrolling to; scroll events on the way are ignored. */
  const target = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const count = media.length;
  const altOf = (m: MediaView, i: number) => m.altText || `@${username} の写真 ${i + 1}`;

  if (count === 1) {
    return <MediaImage media={media[0]!} alt={altOf(media[0]!, 0)} priority={priority} />;
  }

  const go = (to: number) => {
    const el = strip.current;
    if (!el || to < 0 || to >= count || to === index) return;
    const left = to * el.clientWidth;
    target.current = Math.abs(el.scrollLeft - left) < 1 ? null : to;
    setIndex(to);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left, behavior: reduce ? 'instant' : 'smooth' });
  };

  const onScroll = () => {
    const el = strip.current;
    if (!el || el.clientWidth === 0) return;
    const at = Math.round(el.scrollLeft / el.clientWidth);
    if (target.current !== null) {
      if (at === target.current) target.current = null;
      return;
    }
    setIndex(at);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    go(index + (e.key === 'ArrowRight' ? 1 : -1));
  };

  return (
    <div className="relative">
      <div
        ref={strip}
        role="group"
        aria-roledescription="carousel"
        aria-label="投稿の写真"
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        // A touch or wheel by the user takes over from a scroll the buttons started.
        onPointerDown={() => (target.current = null)}
        onWheel={() => (target.current = null)}
        className="flex snap-x snap-mandatory items-center overflow-x-auto bg-surface [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {media.map((m, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}`}
            className="w-full flex-none snap-start snap-always"
          >
            <MediaImage media={m} alt={altOf(m, i)} priority={priority && i === 0} />
          </div>
        ))}
      </div>
      <div
        aria-live="polite"
        className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[length:var(--font-size-xs)] text-white"
      >
        {`${index + 1}/${count}`}
      </div>
      <button
        type="button"
        aria-label="前の写真"
        aria-disabled={index === 0}
        onClick={() => go(index - 1)}
        className={`${arrowButton} left-2`}
      >
        <Chevron direction="left" />
      </button>
      <button
        type="button"
        aria-label="次の写真"
        aria-disabled={index === count - 1}
        onClick={() => go(index + 1)}
        className={`${arrowButton} right-2`}
      >
        <Chevron direction="right" />
      </button>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {media.map((_, i) => (
          <span
            key={i}
            data-testid="carousel-dot"
            data-active={i === index}
            className="h-1.5 w-1.5 rounded-full bg-white/60 data-[active=true]:bg-white"
          />
        ))}
      </div>
    </div>
  );
}
