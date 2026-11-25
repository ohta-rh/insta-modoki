import { lengthOf, type StoryLength } from '../model/viewer-state';

/**
 * The bars at the top of the viewer: one per story, finished ones full, the current one filling
 * with the elapsed time, later ones empty. With "reduce motion" the current bar is a static full
 * bar. The position is read out as "ストーリー n / N" (polite live region).
 */
export function StoryProgress({
  stories,
  index,
  elapsedMs,
}: {
  stories: StoryLength[];
  index: number;
  elapsedMs: number;
}) {
  return (
    <div className="px-2 pt-2">
      <div aria-hidden="true" data-testid="story-progress" className="flex gap-1">
        {stories.map((s, i) => {
          const ratio = i < index ? 1 : i === index ? Math.min(1, elapsedMs / lengthOf(s)) : 0;
          return (
            <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/40">
              <div
                data-current={i === index ? 'true' : undefined}
                className={`h-full bg-white ${i === index ? 'motion-reduce:w-full!' : ''}`}
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
          );
        })}
      </div>
      <p aria-live="polite" className="sr-only">{`ストーリー ${index + 1} / ${stories.length}`}</p>
    </div>
  );
}
