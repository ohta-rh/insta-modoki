// Limits and messages the client also needs. No zod here (ADR-0046).
export const MAX_QUERY = 30;
export const RESULT_LIMIT = 20;
export const SEARCH_RATE_LIMIT = 60;

export const EMPTY_QUERY_MESSAGE = '検索する文字を入力してください';
export const LONG_QUERY_MESSAGE = '検索する文字は 30 文字以内で入力してください';
export const CONTROL_QUERY_MESSAGE = '使えない文字が含まれています';
export const SEARCH_FAILED_MESSAGE = '検索できませんでした。もう一度お試しください';

export const noMatchMessage = (q: string): string => `「${q}」に一致するユーザーはいません`;
