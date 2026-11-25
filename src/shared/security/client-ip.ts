// Only the verified header set by Cloudflare is read; X-Forwarded-For is user-controlled and
// ignored (ADR-0020). Locally there is no such header, so every request shares the key "local".
const IP_SHAPE = /^[0-9a-fA-F:.]{2,45}$/;

export function clientIp(headers: Headers): string {
  const value = headers.get('cf-connecting-ip')?.trim();
  return value && IP_SHAPE.test(value) ? value : 'local';
}
