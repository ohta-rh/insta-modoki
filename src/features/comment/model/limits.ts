// Limits the client also needs. No zod here, so a client component importing them does not pull zod into the browser bundle (ADR-0046).
export const MAX_BODY = 2200;
export const TOO_LONG_MESSAGE = 'コメントは 2,200 字までです';
