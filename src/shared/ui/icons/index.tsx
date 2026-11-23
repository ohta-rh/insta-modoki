import { Icon, type IconProps } from './Icon';

export type { IconProps };

const HEART =
  'M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 8 2.5c0 5.7-8 10.6-8 10.6z';
const HOME = 'M3.5 11 12 3.5 20.5 11v9.5h-6v-6h-5v6h-6z';
const BELL = 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z';
const BOOKMARK = 'M6.5 3.5h11v17L12 16l-5.5 4.5z';

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d={HOME} />
  </Icon>
);
export const SearchIcon = ({ filled, ...p }: IconProps) => (
  // Solid = heavier lens and handle (3), not a filled lens; the svg keeps stroke-width 2.
  <Icon {...p} fill="none" data-filled={filled ? 'true' : undefined}>
    <circle cx="10.5" cy="10.5" r="6.5" strokeWidth={filled ? 3 : undefined} />
    <path d="m15.5 15.5 5 5" strokeWidth={filled ? 3 : undefined} />
  </Icon>
);
export const PlusSquareIcon = ({ filled, ...p }: IconProps) => (
  <Icon filled={filled} {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path className={filled ? 'stroke-bg' : undefined} d="M12 8v8M8 12h8" />
  </Icon>
);
export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d={BELL} />
    <path d="M10 21h4" />
  </Icon>
);
export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d={`M4.5 20.5c.8-4 3.7-6 7.5-6s6.7 2 7.5 6${p.filled ? 'z' : ''}`} />
  </Icon>
);
export const HeartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d={HEART} />
  </Icon>
);
export const HeartFilledIcon = (p: IconProps) => (
  <Icon filled {...p}>
    <path d={HEART} />
  </Icon>
);
export const CommentIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.5-4.4a8.5 8.5 0 1 1 15.5-4.6z" />
  </Icon>
);
export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 3 3 10.5l7 3 3 7z" />
    <path d="M10 13.5 21 3" />
  </Icon>
);
export const BookmarkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d={BOOKMARK} />
  </Icon>
);
export const BookmarkFilledIcon = (p: IconProps) => (
  <Icon filled {...p}>
    <path d={BOOKMARK} />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 5 14 14M19 5 5 19" />
  </Icon>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m14.5 5-7 7 7 7" />
  </Icon>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9.5 5 7 7-7 7" />
  </Icon>
);
export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5.5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1" fill="currentColor" />
  </Icon>
);

export const CompassIcon = ({ filled, ...p }: IconProps) => (
  <Icon filled={filled} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path className={filled ? 'stroke-bg' : undefined} d="m15.5 8.5-2 5-5 2 2-5z" />
  </Icon>
);
export const GridIcon = ({ filled, ...p }: IconProps) => (
  <Icon filled={filled} {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
    <path
      className={filled ? 'stroke-bg' : undefined}
      d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"
    />
  </Icon>
);
/** Two stacked photos: the mark of a post with several photos. */
export const CarouselIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3.5h9a3.5 3.5 0 0 1 3.5 3.5v9" fill="none" />
    <rect x="3.5" y="7.5" width="13" height="13" rx="3" />
  </Icon>
);
export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

/* Solid versions of the navigation icons (the current item): the outline drawn with `filled`. */
export const HomeFilledIcon = (p: IconProps) => <HomeIcon {...p} filled />;
export const SearchFilledIcon = (p: IconProps) => <SearchIcon {...p} filled />;
export const CompassFilledIcon = (p: IconProps) => <CompassIcon {...p} filled />;
export const PlusSquareFilledIcon = (p: IconProps) => <PlusSquareIcon {...p} filled />;
export const BellFilledIcon = (p: IconProps) => <BellIcon {...p} filled />;
export const UserFilledIcon = (p: IconProps) => <UserIcon {...p} filled />;
