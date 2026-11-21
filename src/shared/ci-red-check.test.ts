import { describe, expect, it } from 'vitest';

// Throwaway: proves CI turns red on a failing test (#22 AC-9). Never merged.
describe('ci-red-check', () => {
  it('fails on purpose', () => {
    expect(1).toBe(2);
  });
});
