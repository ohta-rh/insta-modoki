// The Worker entry (wrangler.jsonc `main`): OpenNext's fetch, plus the Cron Trigger (ADR-0049).
// Outside tsconfig's include on purpose: .open-next/worker.js exists only after the build.
import openNext from '../.open-next/worker.js';
import { onScheduled } from './jobs/scheduled.ts';

export default {
  fetch: openNext.fetch,
  scheduled: (controller, env) => onScheduled(controller, env),
};
