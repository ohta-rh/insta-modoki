'use client';

import { useRef } from 'react';
import {
  cropRect,
  frameLayout,
  KEY_STEP_PX,
  moveFocus,
  type Focus,
  type Ratio,
  type Size,
} from '../model/crop';

const ASPECT: Record<Ratio, string> = { '1:1': '1 / 1', '4:5': '4 / 5' };
const ARROWS: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

export type CropFrameProps = {
  /** The photo's number on screen (1 for the first), used in the accessible name. */
  number: number;
  src: string;
  /** The photo's pixels (upright). */
  size: Size;
  ratio: Ratio;
  focus: Focus;
  onFocusChange: (focus: Focus) => void;
  disabled?: boolean;
};

/**
 * Shows the photo in the chosen ratio (`cover`) and lets the user slide the visible part: drag it
 * with a pointer, or press the arrow keys (10px per press). `data-crop` is the crop rectangle in
 * the photo's own pixels, the value `processImage` receives.
 */
export function CropFrame({
  number,
  src,
  size,
  ratio,
  focus,
  onFocusChange,
  disabled = false,
}: CropFrameProps) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; focus: Focus } | null>(null);
  const hintId = `crop-hint-${number}`;
  const rect = cropRect(size, ratio, focus);

  const overflow = () => {
    const { overflowX, overflowY } = frameLayout(size, box.current?.clientWidth ?? 0, ratio);
    return { x: overflowX, y: overflowY };
  };

  return (
    <div className="w-full">
      <div
        ref={box}
        role="group"
        aria-label={`写真 ${number} の切り抜き`}
        aria-describedby={hintId}
        data-crop={`${rect.x},${rect.y},${rect.width},${rect.height}`}
        tabIndex={disabled ? -1 : 0}
        className="relative w-full touch-none overflow-hidden rounded-lg bg-surface outline-offset-2 focus-visible:outline-2 focus-visible:outline-indigo"
        style={{ aspectRatio: ASPECT[ratio], cursor: disabled ? 'default' : 'grab' }}
        onKeyDown={(e) => {
          const step = ARROWS[e.key];
          if (!step || disabled) return;
          e.preventDefault();
          onFocusChange(
            moveFocus(focus, { x: step.x * KEY_STEP_PX, y: step.y * KEY_STEP_PX }, overflow()),
          );
        }}
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, focus };
        }}
        onPointerMove={(e) => {
          const start = drag.current;
          if (!start) return;
          // The photo follows the pointer, so the window moves the opposite way.
          onFocusChange(
            moveFocus(start.focus, { x: start.x - e.clientX, y: start.y - e.clientY }, overflow()),
          );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {/* The preview is decoration: the photo's alternative text is the field below it. */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="h-full w-full select-none object-cover"
          style={{ objectPosition: `${focus.x * 100}% ${focus.y * 100}%` }}
        />
      </div>
      <p id={hintId} className="mt-1 text-[length:var(--font-size-sm)] text-text-muted">
        矢印キーかドラッグで切り抜きの位置を動かせます
      </p>
    </div>
  );
}
