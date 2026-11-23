import type { ComponentProps } from 'react';

type FloatingFieldProps = Omit<ComponentProps<'input'>, 'id' | 'name' | 'placeholder'> & {
  name: string;
  label: string;
  /** The reason shown under the field, tied to it with `aria-describedby`. */
  error?: string;
  /** The border turns red without a sentence of its own (the sentence is elsewhere: `describedBy`). */
  invalid?: boolean;
  describedBy?: string;
  /** The error is announced (`role="alert"`). */
  announce?: boolean;
};

/**
 * A text input whose label sits inside the border and moves up when the field has the focus or a
 * value (the reference's log-in and sign-up fields, docs/research/web-ui-reference.md §2.8).
 * The `placeholder=" "` is only the hook for `:placeholder-shown`; the name stays the `<label for>`.
 */
export function FloatingField({
  name,
  label,
  error,
  invalid,
  describedBy,
  announce,
  className,
  ...rest
}: FloatingFieldProps) {
  const errorId = `${name}-error`;
  const isInvalid = invalid === true || (error !== undefined && error !== '');
  const describedById = error ? errorId : describedBy;
  return (
    <div>
      <div className="relative">
        <input
          id={name}
          name={name}
          placeholder=" "
          className={`peer h-[60px] w-full rounded-2xl border border-input-border bg-bg px-4 pt-5 pb-1 text-[16px] font-medium text-text focus:border-text aria-[invalid=true]:border-danger nav:text-[15px] ${className ?? ''}`}
          aria-invalid={isInvalid ? 'true' : undefined}
          aria-describedby={isInvalid ? describedById : undefined}
          {...rest}
        />
        <label
          htmlFor={name}
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[15px] text-text-secondary transition-all duration-[var(--motion-fast)] peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-[12px] peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[12px]"
        >
          {label}
        </label>
      </div>
      {error ? (
        <p
          id={errorId}
          role={announce ? 'alert' : undefined}
          className="mt-1 text-[length:var(--font-size-sm)] text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
