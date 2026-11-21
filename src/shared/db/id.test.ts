import { describe, expect, it } from 'vitest';
import { newId } from './id';

describe('newId', () => {
  it('UUIDv7 の形になる', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('1,000 個が呼んだ順に昇順になる', () => {
    const ids = Array.from({ length: 1000 }, () => newId());
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(1000);
  });
});
