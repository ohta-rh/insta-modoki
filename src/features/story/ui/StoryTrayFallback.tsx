/** The empty frame shown while the tray loads: as tall as the tray (96px), so nothing shifts. */
export function StoryTrayFallback() {
  return <div aria-hidden="true" className="mb-4 h-24" />;
}
