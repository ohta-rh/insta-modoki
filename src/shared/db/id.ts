let lastMs = 0;
let counter = 0;

const hex = (n: number, width: number) => n.toString(16).padStart(width, '0');

/**
 * UUIDv7 (RFC 9562): 48-bit millisecond timestamp, then a 12-bit counter in the rand_a field so
 * ids made in the same millisecond still sort in call order, then 62 random bits.
 */
export function newId(): string {
  const now = Date.now();
  if (now > lastMs) {
    lastMs = now;
    counter = 0;
  } else {
    counter += 1;
    if (counter > 0xfff) {
      lastMs += 1;
      counter = 0;
    }
  }
  const rand = new Uint8Array(8);
  crypto.getRandomValues(rand);
  rand[0] = (rand[0] & 0x3f) | 0x80; // variant 10xx
  const tail = Array.from(rand, (b) => hex(b, 2)).join('');
  const ms = hex(lastMs, 12);
  return `${ms.slice(0, 8)}-${ms.slice(8)}-7${hex(counter, 3)}-${tail.slice(0, 4)}-${tail.slice(4)}`;
}
