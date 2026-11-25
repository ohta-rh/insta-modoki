/** What sign-up shows under the invite code field (fieldErrors.inviteCode). */
export const INVITE_MESSAGES = {
  required: '招待コードを入力してください',
  unknown: '招待コードが正しくありません',
  revoked: 'この招待コードは無効になりました',
  expired: 'この招待コードは期限が切れています',
  used_up: 'この招待コードは使用回数の上限に達しました',
} as const;
