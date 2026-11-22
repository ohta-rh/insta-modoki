/** Escapes `\`, `%` and `_` so a LIKE pattern built from it matches them literally (use `ESCAPE '\'`). `\` goes first. */
export function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
