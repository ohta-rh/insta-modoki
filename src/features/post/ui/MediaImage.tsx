import type { MediaView } from '../model/schema';
import { thumbhashAverageColor, thumbhashDataUrl } from '../model/thumbhash';

/** The photo's column is at most 600px wide on a wide screen and the whole width on a narrow one. */
const SIZES = '(min-width: 768px) 600px, 100vw';

/**
 * One photo. The box takes the photo's own shape from `width` and `height` before a single byte
 * arrives (no layout shift) and shows the blurred ThumbHash (first photo) or its average colour (the rest) until the photo is painted. Only the
 * first photo of a screen is loaded eagerly and with high priority; the rest are lazy.
 */
export function MediaImage({
  media,
  alt,
  priority = false,
  fill = false,
}: {
  media: MediaView;
  alt: string;
  priority?: boolean;
  /** On a wide screen the photo fills its box (letterboxed), for the two-column post (#94). */
  fill?: boolean;
}) {
  // The blurred PNG is ~5.7KB inline; only the photo painted first carries it (ADR-0074), the rest
  // show the ThumbHash's average colour so the HTML stays small.
  const placeholder = priority ? thumbhashDataUrl(media.thumbhash) : null;
  const averageColor = priority ? null : thumbhashAverageColor(media.thumbhash);
  const { w320, w640, w1080 } = media.srcset;
  return (
    <img
      src={w640}
      srcSet={`${w320} 320w, ${w640} 640w, ${w1080} 1080w`}
      sizes={SIZES}
      width={media.width}
      height={media.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={`block h-auto w-full bg-cover ${fill ? 'lg:h-full lg:object-contain' : ''}`}
      style={{
        aspectRatio: `${media.width} / ${media.height}`,
        backgroundImage: placeholder ? `url("${placeholder}")` : undefined,
        backgroundColor: averageColor ?? undefined,
      }}
    />
  );
}
