'use client';

import { useEffect, useRef } from 'react';
import { charLength } from '../../../shared/text';
import type { Focus, Ratio, Size } from '../model/crop';
import { ALT_TEXT_MESSAGE, MAX_ALT_TEXT } from '../model/limits';
import { CropFrame } from './CropFrame';

export type PhotoItem = {
  id: string;
  name: string;
  /** An object URL of the picked file, for the preview. */
  url: string;
  size: Size;
  focus: Focus;
  altText: string;
};

export type PhotoAction = 'prev' | 'next' | 'remove';

export type PhotoListProps = {
  photos: PhotoItem[];
  ratio: Ratio;
  disabled: boolean;
  onMove: (id: string, by: -1 | 1) => void;
  onRemove: (id: string) => void;
  onAltText: (id: string, text: string) => void;
  onFocusChange: (id: string, focus: Focus) => void;
  /** Which button to give focus after a re-render (the list reorders the DOM, which drops focus). */
  focusRequest: { id: string; action: PhotoAction } | null;
};

const SECONDARY =
  'min-h-[var(--tap-min)] rounded-lg border border-border px-3 font-bold aria-disabled:opacity-40 disabled:opacity-50';

/** The picked photos in order: each with its crop frame, alternative text and reorder / remove buttons. */
export function PhotoList({
  photos,
  ratio,
  disabled,
  onMove,
  onRemove,
  onAltText,
  onFocusChange,
  focusRequest,
}: PhotoListProps) {
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!focusRequest) return;
    const item = list.current?.querySelector<HTMLElement>(`[data-photo-id="${focusRequest.id}"]`);
    item?.querySelector<HTMLElement>(`[data-action="${focusRequest.action}"]`)?.focus();
  }, [focusRequest]);

  return (
    <ul ref={list} aria-label="選んだ写真" className="flex flex-col gap-6">
      {photos.map((photo, i) => {
        const n = i + 1;
        const altOver = charLength(photo.altText) > MAX_ALT_TEXT;
        const first = i === 0;
        const last = i === photos.length - 1;
        return (
          <li
            key={photo.id}
            aria-label={`写真 ${n}`}
            data-photo-id={photo.id}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="sm:w-56 sm:shrink-0">
              <CropFrame
                number={n}
                src={photo.url}
                size={photo.size}
                ratio={ratio}
                focus={photo.focus}
                disabled={disabled}
                onFocusChange={(focus) => onFocusChange(photo.id, focus)}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="truncate text-[length:var(--font-size-sm)] text-text-muted">
                {photo.name}
              </p>
              <label
                htmlFor={`alt-${photo.id}`}
                className="text-[length:var(--font-size-sm)] font-bold"
              >
                写真 {n} の代替テキスト
              </label>
              <textarea
                id={`alt-${photo.id}`}
                value={photo.altText}
                rows={2}
                disabled={disabled}
                aria-invalid={altOver ? 'true' : undefined}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-[length:var(--font-size-md)] text-text aria-[invalid=true]:border-red-600"
                onChange={(e) => onAltText(photo.id, e.currentTarget.value)}
              />
              {altOver && (
                <p role="alert" className="text-[length:var(--font-size-sm)] text-red-700">
                  {ALT_TEXT_MESSAGE}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-action="prev"
                  className={SECONDARY}
                  disabled={disabled}
                  aria-disabled={first ? 'true' : undefined}
                  aria-label={`前へ（写真 ${n}）`}
                  onClick={() => !first && onMove(photo.id, -1)}
                >
                  前へ
                </button>
                <button
                  type="button"
                  data-action="next"
                  className={SECONDARY}
                  disabled={disabled}
                  aria-disabled={last ? 'true' : undefined}
                  aria-label={`後ろへ（写真 ${n}）`}
                  onClick={() => !last && onMove(photo.id, 1)}
                >
                  後ろへ
                </button>
                <button
                  type="button"
                  data-action="remove"
                  className={SECONDARY}
                  disabled={disabled}
                  aria-label={`この写真を外す（写真 ${n}）`}
                  onClick={() => onRemove(photo.id)}
                >
                  この写真を外す
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
