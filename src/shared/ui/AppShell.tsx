import type { ComponentProps, ComponentType, MouseEvent, ReactNode } from 'react';
import { FOOTER_NOTICE } from './brand';
import {
  BellIcon,
  CompassIcon,
  HomeIcon,
  MenuIcon,
  PlusSquareIcon,
  SearchIcon,
  UserIcon,
  type IconProps,
} from './icons';
import { Logo } from './Logo';
import { MORE_MENU_ID, MoreMenu } from './MoreMenu';
import { SIDE_PANEL_ID, SidePanel } from './SidePanel';
import { isCurrent, navItems, type NavIcon, type NavItem, type Viewer } from './nav-items';

const ICONS: Record<NavIcon, ComponentType<IconProps>> = {
  home: HomeIcon,
  search: SearchIcon,
  compass: CompassIcon,
  'plus-square': PlusSquareIcon,
  bell: BellIcon,
  user: UserIcon,
};

export type PanelKey = 'search' | 'notifications';

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
  panels?: Partial<Record<PanelKey, { title: string; content: ReactNode }>>;
  openPanel?: PanelKey | null;
  /** Click handler of a navigation item that opens a panel. */
  onPanelClick?: (key: PanelKey, event: MouseEvent<HTMLAnchorElement>) => void;
  /** Sign-up and log-in screens render without navigation. */
  hideNav?: boolean;
  children: ReactNode;
};

function SkipLink() {
  return (
    <a href="#main" className="shell-skip">
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
  panels?: AppShellProps['panels'];
  openPanel?: PanelKey | null;
  onPanelClick?: AppShellProps['onPanelClick'];
};

function NavLinks({
  items,
  current,
  viewer,
  badges,
  linkAs,
  panels,
  openPanel,
  onPanelClick,
  layout,
}: NavProps & { layout: 'side' | 'bottom' }) {
  return (
    <>
      {items
        .filter((item) => layout === 'side' || item.placement === 'all')
        .map((item) => {
          const Icon = ICONS[item.icon];
          const isHere = isCurrent(item, current, viewer);
          const Link = linkAs?.[item.key] ?? 'a';
          const badge = badges?.[item.key];
          const panelKey = layout === 'side' && panels?.[item.key as PanelKey] ? item.key : null;
          const panelProps =
            panelKey === null
              ? {}
              : {
                  'data-panel': panelKey,
                  'aria-expanded': openPanel === panelKey,
                  'aria-controls': SIDE_PANEL_ID,
                  onClick: (e: MouseEvent<HTMLAnchorElement>) =>
                    onPanelClick?.(panelKey as PanelKey, e),
                };
          const folded = openPanel != null;
          const link = (
            <Link
              key={badge ? undefined : item.key}
              href={item.href}
              aria-current={isHere ? 'page' : undefined}
              {...panelProps}
              className={layout === 'side' ? 'shell-item' : 'shell-tab'}
            >
              <Icon filled={isHere} />
              <span
                className={
                  layout === 'side' && !folded ? 'sr-only nav-wide:not-sr-only' : 'sr-only'
                }
              >
                {item.label}
              </span>
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
                  layout === 'bottom'
                    ? 'shell-badge-tab'
                    : folded
                      ? 'shell-badge-folded'
                      : 'shell-badge-side'
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

function MoreButton({ folded }: { folded: boolean }) {
  return (
    <button type="button" popoverTarget={MORE_MENU_ID} className="shell-item w-full text-left">
      <MenuIcon />
      <span className={folded ? 'sr-only' : 'sr-only nav-wide:not-sr-only'}>その他</span>
    </button>
  );
}

function SideNav({
  items,
  current,
  viewer,
  badges,
  linkAs,
  panels,
  openPanel,
  onPanelClick,
}: NavProps) {
  return (
    <nav
      aria-label="メイン"
      data-nav="side"
      data-panel-open={openPanel != null ? '' : undefined}
      // pr-[11px]: 72 - 1 (border) - 12 - 11 = 48px wide items at the narrow width.
      className={openPanel != null ? 'shell-side shell-side-folded' : 'shell-side'}
    >
      <div className="mb-4 flex min-h-12 items-center px-3">
        <span className={openPanel != null ? '' : 'nav-wide:hidden'}>
          <Logo size={24} />
        </span>
        <span className={openPanel != null ? 'hidden' : 'hidden nav-wide:inline'}>
          <Logo withName />
        </span>
      </div>
      <NavLinks
        items={items}
        current={current}
        viewer={viewer}
        badges={badges}
        linkAs={linkAs}
        panels={panels}
        openPanel={openPanel}
        onPanelClick={onPanelClick}
        layout="side"
      />
      {viewer ? (
        <div className="mt-auto">
          <MoreButton folded={openPanel != null} />
        </div>
      ) : null}
    </nav>
  );
}

function TopBar() {
  return (
    <header data-shell-top-bar className="shell-top">
      <Logo size={24} withName />
      <button type="button" popoverTarget={MORE_MENU_ID} className="shell-top-more">
        <MenuIcon />
        <span className="sr-only">その他</span>
      </button>
    </header>
  );
}

function BottomNav({ items, current, viewer, badges, linkAs }: NavProps) {
  return (
    <nav aria-label="メイン" data-nav="bottom" className="shell-bottom">
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
      data-shell-footer
      className={`shell-footer ${
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
  panels,
  openPanel = null,
  onPanelClick,
  hideNav = false,
  children,
}: AppShellProps) {
  const items = navItems(viewer);
  return (
    <div className="min-h-screen bg-bg text-text">
      <SkipLink />
      {viewer && !hideNav ? <TopBar /> : null}
      <div className="mx-auto flex min-h-screen w-full justify-center">
        {hideNav ? null : (
          <SideNav
            items={items}
            current={currentPath}
            viewer={viewer}
            badges={badges}
            linkAs={linkAs}
            panels={panels}
            openPanel={openPanel}
            onPanelClick={onPanelClick}
          />
        )}
        {viewer && !hideNav && panels ? <SidePanel panels={panels} open={openPanel} /> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <main
            id="main"
            className="mx-auto w-full max-w-[var(--content-max)] flex-1 has-[[data-page-width=wide]]:max-w-none"
          >
            {children}
          </main>
          <Footer hideNav={hideNav} />
        </div>
      </div>
      {viewer && !hideNav ? <MoreMenu /> : null}
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
