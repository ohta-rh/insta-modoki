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
