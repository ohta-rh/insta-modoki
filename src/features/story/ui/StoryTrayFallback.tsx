/** The empty frame shown while the tray loads: as tall as the tray (102px) with its 24px margin, so nothing shifts. */
export function StoryTrayFallback() {
  return <div aria-hidden="true" className="mb-6 h-[102px]" />;
}
