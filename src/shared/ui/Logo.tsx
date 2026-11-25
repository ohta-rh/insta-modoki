import { BRAND } from './brand';

/** Own mark: an arched window with rays of sun (docs/architecture/design-system.md). */
export function Logo({ size = 32, withName = false }: { size?: number; withName?: boolean }) {
  return (
    <span
      role="img"
      aria-label={`${BRAND.name}（仮称）`}
      className="inline-flex items-center gap-2"
    >
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="mado-window" gradientTransform="rotate(30 .5 .5)">
            <stop offset="0" stopColor="#0bb8a9" />
            <stop offset=".62" stopColor="#2b6cf6" />
            <stop offset="1" stopColor="#4f46c8" />
          </linearGradient>
        </defs>
        <path d="M8 44V22a16 16 0 0 1 32 0v22z" fill="url(#mado-window)" />
        <path d="M14 44a10 10 0 0 1 20 0z" fill="#fff" />
        <path
          d="M24 26v5M15.5 29.5l3.2 3.2M32.5 29.5l-3.2 3.2"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {withName ? (
        <span aria-hidden="true" className="text-[length:var(--font-size-lg)] font-bold text-text">
          {BRAND.name}
        </span>
      ) : null}
    </span>
  );
}
