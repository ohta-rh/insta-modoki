import type { Page } from '@playwright/test';

/** Waits until React has hydrated the page (the root layout's marker sets `html[data-hydrated="1"]`). */
export async function waitForHydration(page: Page): Promise<void> {
  await page.locator('html[data-hydrated="1"]').waitFor({ state: 'attached' });
}

/** Lets two animation frames pass, so a scroll or state change the last input caused would have shown. */
export const nextFrames = (page: Page): Promise<void> =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

/**
 * Holds every `_next/static/chunks` request back, so the next page stays un-hydrated (the
 * pre-hydration, no-JS path). Returns the release function; it throws if no chunk request was
 * held, because then the test did not exercise the un-hydrated page at all.
 */
export async function holdScripts(page: Page): Promise<() => void> {
  let open!: () => void;
  const gate = new Promise<void>((resolve) => (open = resolve));
  let held = 0;
  await page.route('**/_next/static/chunks/**', async (route) => {
    held += 1;
    await gate;
    await route.continue();
  });
  return () => {
    open();
    if (held === 0) throw new Error('holdScripts: no script chunk request was held');
  };
}
