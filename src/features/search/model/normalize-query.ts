/** The form a query is compared in: no outer spaces (full-width too), NFKC, lower case. */
export function normalizeQuery(q: string): string {
  return q.trim().normalize('NFKC').toLowerCase();
}
