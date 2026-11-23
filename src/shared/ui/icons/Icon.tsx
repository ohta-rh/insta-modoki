import type { ReactNode, SVGProps } from 'react';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children' | 'viewBox'> & { size?: number };

type BaseProps = IconProps & { children: ReactNode; filled?: boolean };

/** 24px grid, 2 stroke (ADR-0056); `filled` draws the solid version (`data-filled`). Decorative: the button or link using it carries the name. */
export function Icon({ size = 24, filled = false, children, ...rest }: BaseProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-filled={filled ? 'true' : undefined}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}
