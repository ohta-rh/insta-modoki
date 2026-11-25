/** Length in Unicode code points (an emoji is 1, not 2 UTF-16 units). Used for every character limit. */
export const charLength = (s: string): number => Array.from(s).length;

/** NUL, other C0/C1 controls and DEL. SQLite's length() stops at NUL, so they are rejected up front. */
export const hasControlChars = (s: string): boolean => {
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f)) return true;
  }
  return false;
};
