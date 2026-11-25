import { parseCaption } from '../hashtag';

/**
 * A post's caption as text, with each `#tag` a link to its list. Everything is rendered as React
 * text (never as HTML), so markup in a caption shows up as the characters it is.
 */
export function CaptionText({ caption }: { caption: string }) {
  return (
    <>
      {parseCaption(caption).map((part, i) =>
        part.type === 'tag' ? (
          <a key={i} href={`/explore/tags/${encodeURIComponent(part.name)}`} className="text-link">
            {part.text}
          </a>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
