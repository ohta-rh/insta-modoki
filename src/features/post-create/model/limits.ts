// Limits and messages the client also needs. No zod here (ADR-0046).
export const MAX_PHOTOS = 10;
export const MAX_CAPTION = 2200;
export const MAX_ALT_TEXT = 500;

export const CAPTION_MESSAGE = 'キャプションは 2,200 字までです';
export const ALT_TEXT_MESSAGE = '代替テキストは 500 字までです';
