import { headers } from 'next/headers';
import { logUnexpected } from '../../../shared/action';
import { listStoryTray, type StoryTrayView } from '../api/list-story-tray';
import { StoryTray } from './StoryTray';

/**
 * The tray for the home page, read on the server. A failed read must not stop the feed: it is
 * logged by name and the tray falls back to the add button alone. (The (app) layout has already
 * sent a visitor without a session to the login screen, so UNAUTHENTICATED lands here too.)
 */
export async function StoryTraySection({
  load = async () => listStoryTray({}, { headers: await headers() }),
}: { load?: () => Promise<StoryTrayView> } = {}) {
  let view: StoryTrayView | null = null;
  try {
    view = await load();
  } catch (error) {
    logUnexpected('listStoryTray', error);
  }
  return <StoryTray view={view} />;
}
