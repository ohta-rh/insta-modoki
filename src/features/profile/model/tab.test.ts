import { describe, expect, it } from 'vitest';
import { profileTab } from './tab';

describe('profileTab', () => {
  it('本人で tab が saved のときだけ saved を返す', () => {
    expect(profileTab(true, 'saved')).toBe('saved');
    expect(profileTab(false, 'saved')).toBe('posts');
    expect(profileTab(true, 'foo')).toBe('posts');
    expect(profileTab(true, undefined)).toBe('posts');
    expect(profileTab(true, ['saved', 'saved'])).toBe('posts');
    expect(profileTab(true, '')).toBe('posts');
    expect(profileTab(false, undefined)).toBe('posts');
  });
});
