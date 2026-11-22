import { describe, expect, it } from 'vitest';
import { escapeLike } from './like-pattern';

describe('escapeLike', () => {
  it('% と _ と \\ を文字どおりに扱うパターンを作る', () => {
    expect(escapeLike('a_%\\')).toBe('a\\_\\%\\\\');
    expect(escapeLike('plain')).toBe('plain');
  });
});
