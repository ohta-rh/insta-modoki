const sorted = (values) => {
  if (values.length === 0) throw new Error('empty list');
  return [...values].sort((a, b) => a - b);
};

export function median(values) {
  const s = sorted(values);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Nearest rank: the ceil(0.95 * n)-th smallest value. */
export function p95(values) {
  const s = sorted(values);
  return s[Math.ceil(0.95 * s.length) - 1];
}
