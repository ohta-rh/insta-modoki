export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const CODE_LENGTH = 10;
export const CODE_PATTERN = /^[A-Z0-9]{10}$/;

/** 256 is not a multiple of 36, so bytes from this value up would favour the first letters. */
const LIMIT = 252;

type Fill = (buffer: Uint8Array) => Uint8Array;

/**
 * An invite code: 10 characters of A-Z and 0-9 from the cryptographic random source. A byte of
 * 252 or more is thrown away and drawn again (rejection sampling), so every character has the
 * same chance.
 */
export function generateCode(fill: Fill = (b) => crypto.getRandomValues(b)): string {
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of fill(new Uint8Array(CODE_LENGTH * 2))) {
      if (byte >= LIMIT) continue;
      code += ALPHABET[byte % ALPHABET.length];
      if (code.length === CODE_LENGTH) break;
    }
  }
  return code;
}

/** What a person typed, as a code: surrounding whitespace removed, upper-cased. */
export const normalizeCode = (value: string): string => value.trim().toUpperCase();
