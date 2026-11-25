import type { ReactNode, SVGProps } from 'react';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children' | 'viewBox'> & { size?: number };

type BaseProps = IconProps & { children: ReactNode; filled?: boolean };

/** 24px grid, 1.5 stroke. Decorative: the button or link using it carries the name. */
export function Icon({ size = 24, filled = false, children, ...rest }: BaseProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}
