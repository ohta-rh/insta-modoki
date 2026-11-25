import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** WCAG 2.2 AA: the tags the plan's accessibility target names. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Runs axe on the whole page and expects no `critical` or `serious` violation. A failure names each
 * rule, what it says and how many elements break it, so the screen can be fixed from the output.
 */
export async function expectNoSeriousViolations(page: Page, label: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  const detail = serious
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help} - ${v.nodes.length} 要素 ` +
        `[${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(' '))
          .join(' | ')}]`,
    )
    .join('\n');
  expect(serious.length, `${label}\n${detail}`).toBe(0);
}
