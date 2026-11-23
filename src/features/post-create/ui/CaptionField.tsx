'use client';

import { charLength } from '../../../shared/text';
import { CAPTION_MESSAGE, MAX_CAPTION } from '../model/limits';

export type CaptionFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const format = (n: number): string => n.toLocaleString('en-US');

/** The caption box with its `n / 2,200` count (code points). Over the limit it turns red and says so. */
export function CaptionField({ value, onChange, disabled = false }: CaptionFieldProps) {
  const length = charLength(value);
  const over = length > MAX_CAPTION;
  return (
    <div>
      <label htmlFor="caption" className="mb-1 block text-[length:var(--font-size-sm)] font-bold">
        キャプション
      </label>
      <textarea
        id="caption"
        value={value}
        rows={4}
        disabled={disabled}
        aria-invalid={over ? 'true' : undefined}
        aria-describedby="caption-count"
        className="min-h-[var(--tap-min)] w-full rounded-lg border border-border bg-bg px-3 py-2 text-[length:var(--font-size-md)] text-text aria-[invalid=true]:border-danger"
        onChange={(e) => onChange(e.currentTarget.value)}
      />
      <p
        id="caption-count"
        className={`mt-1 text-right text-[length:var(--font-size-sm)] ${over ? 'font-bold text-danger' : 'text-text-secondary'}`}
      >
        {format(length)} / {format(MAX_CAPTION)}
      </p>
      {over && (
        <p role="alert" className="text-[length:var(--font-size-sm)] text-danger">
          {CAPTION_MESSAGE}
        </p>
      )}
    </div>
  );
}
