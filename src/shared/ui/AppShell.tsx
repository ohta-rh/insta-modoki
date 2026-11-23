import type { ComponentProps, ComponentType, ReactNode } from 'react';
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
  /** Extra content placed right after a navigation item's label (the unread badge), by item key. */
  badges?: Partial<Record<NavItem['key'], ReactNode>>;
  /**
   * Replaces the `<a>` of a navigation item by a component taking the same props (a client
   * component of a feature, which sets an `aria-label` from client state such as the unread count).
   */
  linkAs?: Partial<Record<NavItem['key'], ComponentType<ComponentProps<'a'>>>>;
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

type NavProps = {
  items: NavItem[];
  current: string;
  viewer: Viewer;
  badges?: AppShellProps['badges'];
  linkAs?: AppShellProps['linkAs'];
};

function NavLinks({
  items,
  current,
  viewer,
  badges,
  linkAs,
  layout,
}: NavProps & { layout: 'side' | 'bottom' }) {
  return (
    <>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const isHere = isCurrent(item, current, viewer);
        const Link = linkAs?.[item.key] ?? 'a';
        const badge = badges?.[item.key];
        const link = (
          <Link
            key={badge ? undefined : item.key}
            href={item.href}
            aria-current={isHere ? 'page' : undefined}
            className={
              layout === 'side'
                ? `flex min-h-[var(--tap-min)] items-center gap-3 rounded-lg border-l-2 border-transparent px-3 text-[length:var(--font-size-md)] text-text hover:bg-surface aria-[current=page]:border-indigo aria-[current=page]:font-bold aria-[current=page]:text-text ${TRANSITION}`
                : `relative flex h-full min-h-[var(--tap-min)] min-w-[var(--tap-min)] flex-1 flex-col items-center justify-center gap-0.5 border-t-2 border-transparent text-[length:var(--font-size-xs)] text-text-secondary aria-[current=page]:border-indigo aria-[current=page]:font-bold aria-[current=page]:text-text ${TRANSITION}`
            }
          >
            <Icon />
            <span>{item.label}</span>
          </Link>
        );
        if (!badge) return link;
        // The badge sits beside the link, not in it: its digits would be visible text that the
        // link's accessible name (set with aria-label) does not contain (WCAG 2.5.3).
        return (
          <div key={item.key} className={layout === 'side' ? 'relative' : 'relative flex flex-1'}>
            {link}
            <span
              className={`pointer-events-none absolute ${
                layout === 'side'
                  ? 'top-1/2 right-3 -translate-y-1/2'
                  : 'top-0.5 left-[calc(50%+4px)]'
              }`}
            >
              {badge}
            </span>
          </div>
        );
      })}
    </>
  );
}

function SideNav({ items, current, viewer, badges, linkAs }: NavProps) {
  return (
    <nav
      aria-label="メイン"
      data-nav="side"
      className="sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col gap-1 border-r border-border p-3 nav:flex"
    >
      <div className="mb-4 flex min-h-[var(--tap-min)] items-center px-3">
        <Logo withName />
      </div>
      <NavLinks
        items={items}
        current={current}
        viewer={viewer}
        badges={badges}
        linkAs={linkAs}
        layout="side"
      />
    </nav>
  );
}

function BottomNav({ items, current, viewer, badges, linkAs }: NavProps) {
  return (
    <nav
      aria-label="メイン"
      data-nav="bottom"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] nav:hidden"
    >
      <NavLinks
        items={items}
        current={current}
        viewer={viewer}
        badges={badges}
        linkAs={linkAs}
        layout="bottom"
      />
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

export function AppShell({
  currentPath,
  viewer,
  badges,
  linkAs,
  hideNav = false,
  children,
}: AppShellProps) {
  const items = navItems(viewer);
  return (
    <div className="min-h-screen bg-bg text-text">
      <SkipLink />
      <div className="mx-auto flex min-h-screen w-full justify-center">
        {hideNav ? null : (
          <SideNav
            items={items}
            current={currentPath}
            viewer={viewer}
            badges={badges}
            linkAs={linkAs}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="main" className="mx-auto w-full max-w-[var(--content-max)] flex-1">
            {children}
          </main>
          <Footer hideNav={hideNav} />
        </div>
      </div>
      {hideNav ? null : (
        <BottomNav
          items={items}
          current={currentPath}
          viewer={viewer}
          badges={badges}
          linkAs={linkAs}
        />
      )}
    </div>
  );
}
