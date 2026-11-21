import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { FOOTER_NOTICE } from './brand';
import { BellIcon, HomeIcon, PlusSquareIcon, SearchIcon, UserIcon, type IconProps } from './icons';
import { Logo } from './Logo';
import { isCurrent, navItems, type NavIcon, type NavItem, type Viewer } from './nav-items';

const ICONS: Record<NavIcon, ComponentType<IconProps>> = {
  home: HomeIcon,
  search: SearchIcon,
  'plus-square': PlusSquareIcon,
  bell: BellIcon,
  user: UserIcon,
};

export type AppShellProps = {
  currentPath: string;
  viewer: Viewer;
  /** Sign-up and log-in screens render without navigation. */
  hideNav?: boolean;
  children: ReactNode;
};

const TRANSITION = 'transition-colors duration-[var(--motion-fast)]';

function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-bg focus:px-4 focus:py-3 focus:text-text"
    >
      本文へ移動
    </a>
  );
}

type NavProps = { items: NavItem[]; current: string; viewer: Viewer };

function NavLinks({ items, current, viewer, layout }: NavProps & { layout: 'side' | 'bottom' }) {
  return (
    <>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const isHere = isCurrent(item, current, viewer);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isHere ? 'page' : undefined}
            className={
              layout === 'side'
                ? `flex min-h-[var(--tap-min)] items-center gap-3 rounded-lg border-l-2 border-transparent px-3 text-[length:var(--font-size-md)] text-text-secondary hover:bg-surface aria-[current=page]:border-indigo aria-[current=page]:font-bold aria-[current=page]:text-text ${TRANSITION}`
                : `flex h-full min-h-[var(--tap-min)] min-w-[var(--tap-min)] flex-1 flex-col items-center justify-center gap-0.5 border-t-2 border-transparent text-[length:var(--font-size-xs)] text-text-secondary aria-[current=page]:border-indigo aria-[current=page]:font-bold aria-[current=page]:text-text ${TRANSITION}`
            }
          >
            <Icon />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

function SideNav({ items, current, viewer }: NavProps) {
  return (
    <nav
      aria-label="メイン"
      data-nav="side"
      className="sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col gap-1 border-r border-border p-3 nav:flex"
    >
      <a href="/" className="mb-4 flex min-h-[var(--tap-min)] items-center px-3">
        <Logo withName />
      </a>
      <NavLinks items={items} current={current} viewer={viewer} layout="side" />
    </nav>
  );
}

function BottomNav({ items, current, viewer }: NavProps) {
  return (
    <nav
      aria-label="メイン"
      data-nav="bottom"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] nav:hidden"
    >
      <NavLinks items={items} current={current} viewer={viewer} layout="bottom" />
    </nav>
  );
}

function Footer({ hideNav }: { hideNav: boolean }) {
  return (
    <footer
      className={`px-4 py-6 text-center text-[length:var(--font-size-xs)] text-text-secondary ${
        hideNav
          ? ''
          : 'pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+var(--space-4))] nav:pb-6'
      }`}
    >
      {FOOTER_NOTICE}
    </footer>
  );
}

export function AppShell({ currentPath, viewer, hideNav = false, children }: AppShellProps) {
  const items = navItems(viewer);
  return (
    <div className="min-h-screen bg-bg text-text">
      <SkipLink />
      <div className="mx-auto flex min-h-screen w-full justify-center">
        {hideNav ? null : <SideNav items={items} current={currentPath} viewer={viewer} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="main" className="mx-auto w-full max-w-[var(--content-max)] flex-1">
            {children}
          </main>
          <Footer hideNav={hideNav} />
        </div>
      </div>
      {hideNav ? null : <BottomNav items={items} current={currentPath} viewer={viewer} />}
    </div>
  );
}
