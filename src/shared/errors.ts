export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE';

/** Default messages shown on screen as-is (docs/architecture/conventions.md "エラー"). */
export const DEFAULT_MESSAGES: Record<AppErrorCode, string> = {
  UNAUTHENTICATED: 'ログインしてください',
  FORBIDDEN: 'この操作はできません',
  NOT_FOUND: 'ページが見つかりません',
  VALIDATION: '入力を確認してください',
  CONFLICT: 'この操作は競合しました',
  RATE_LIMITED: '操作が多すぎます。しばらくしてからもう一度お試しください',
  PAYLOAD_TOO_LARGE: 'ファイルが大きすぎます（1 枚 10MB まで）',
};

export type AppErrorOptions = {
  message?: string;
  fieldErrors?: Record<string, string[]>;
  retryAfterSec?: number;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly fieldErrors?: Record<string, string[]>;
  readonly retryAfterSec?: number;

  constructor(code: AppErrorCode, options: AppErrorOptions = {}) {
    super(options.message ?? DEFAULT_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.fieldErrors = options.fieldErrors;
    this.retryAfterSec = options.retryAfterSec;
  }
}

const HTTP_STATUS: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
};

/** HTTP status for a code (docs/architecture/conventions.md "エラー"). */
export const httpStatusOf = (code: AppErrorCode): number => HTTP_STATUS[code];

export const INTERNAL_MESSAGE = 'エラーが発生しました。しばらくしてからもう一度お試しください';

export type ErrorBody = {
  code: AppErrorCode | 'INTERNAL';
  message: string;
  fieldErrors?: Record<string, string[]>;
  retryAfterSec?: number;
};

/**
 * The response for a thrown value. An AppError is passed through; anything else is replaced by
 * a fixed message so SQL, stack traces and file paths never reach the client.
 */
export function toErrorResponse(error: unknown): { status: number; body: ErrorBody } {
  if (error instanceof AppError) {
    const body: ErrorBody = { code: error.code, message: error.message };
    if (error.fieldErrors) body.fieldErrors = error.fieldErrors;
    if (error.retryAfterSec !== undefined) body.retryAfterSec = error.retryAfterSec;
    return { status: httpStatusOf(error.code), body };
  }
  return { status: 500, body: { code: 'INTERNAL', message: INTERNAL_MESSAGE } };
}
