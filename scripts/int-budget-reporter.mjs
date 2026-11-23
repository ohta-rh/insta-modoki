// vitest reporter for scripts/int-budget.mjs: writes { file, name, durationMs, timeoutMs } of every
// test that ran (skipped ones are left out) to node_modules/.cache/int-budget/results.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';

export const RESULTS_PATH = 'node_modules/.cache/int-budget/results.json';

export default class IntBudgetReporter {
  results = [];

  onTestCaseResult(testCase) {
    if (testCase.result().state === 'skipped') return;
    this.results.push({
      file: relative(process.cwd(), testCase.module.moduleId),
      name: testCase.name,
      durationMs: testCase.diagnostic()?.duration ?? 0,
      timeoutMs: testCase.options.timeout,
    });
  }

  onTestRunEnd() {
    mkdirSync(dirname(RESULTS_PATH), { recursive: true });
    writeFileSync(RESULTS_PATH, JSON.stringify(this.results));
  }
}
