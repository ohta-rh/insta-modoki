import { describe, expect, it } from 'vitest';
import { clientIp } from './client-ip';

describe('clientIp', () => {
  it('cf-connecting-ip があるとき その値を返す', () => {
    expect(clientIp(new Headers({ 'cf-connecting-ip': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('IPv6 のとき その値を返す', () => {
    expect(clientIp(new Headers({ 'cf-connecting-ip': '2001:db8::1' }))).toBe('2001:db8::1');
  });

  it('cf-connecting-ip が無いとき local を返す', () => {
    expect(clientIp(new Headers())).toBe('local');
  });

  it('x-forwarded-for だけのとき 無視して local を返す', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '198.51.100.9' }))).toBe('local');
  });

  it('IP の形でない値のとき local を返す', () => {
    expect(clientIp(new Headers({ 'cf-connecting-ip': 'a b; DROP' }))).toBe('local');
    expect(clientIp(new Headers({ 'cf-connecting-ip': 'x'.repeat(100) }))).toBe('local');
  });
});
