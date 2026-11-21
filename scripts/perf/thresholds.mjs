// Performance budget (proposal 07 非機能要件, ADR-0046). KB is counted as 1,000 bytes (the stricter reading).
export const THRESHOLDS = {
  lighthouseScore: 90,
  lcpMs: 2500,
  inpMs: 200,
  cls: 0.1,
  feedApiP95Ms: 300,
  initialJsGzipBytes: 170000,
};

/** The score is a floor; every other indicator is a ceiling. */
const FLOORS = new Set(['lighthouseScore']);

/**
 * @param {{ indicator: string, screen: string, value: number }[]} results
 * @returns {{ indicator: string, screen: string, value: number, limit: number }[]}
 */
export function evaluate(results) {
  const violations = [];
  for (const { indicator, screen, value } of results) {
    if (!(indicator in THRESHOLDS)) throw new Error(`unknown indicator: ${indicator}`);
    const limit = THRESHOLDS[indicator];
    const bad = FLOORS.has(indicator) ? value < limit : value > limit;
    if (bad) violations.push({ indicator, screen, value, limit });
  }
  return violations;
}

export function formatViolation({ indicator, screen, value, limit }) {
  return `perf: FAIL ${indicator} ${screen} ${value} ${FLOORS.has(indicator) ? '<' : '>'} ${limit}`;
}
