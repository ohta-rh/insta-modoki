---
type: ADR
title: "ADR-0029: サインアップは利用者・パスワード・セッションを 1 つの db.batch で書き、ログイン必須の画面はルートグループ (app) のレイアウトで守る"
description: "D1 では Better Auth のアダプターがトランザクションを使えないので、サインアップの 3 行は自前の db.batch で書き Cookie は Better Auth の形式で署名する。users に email_verified を足す。セッションは 30 日・延長なし。保護は src/app/(app)/layout.tsx。"
tags: [architecture, auth, security]
status: stable
---

# ADR-0029: サインアップは利用者・パスワード・セッションを 1 つの db.batch で書き、ログイン必須の画面はルートグループ (app) のレイアウトで守る

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: #26、[ADR-0019](0019-d1-and-drizzle.md)、[ADR-0020](0020-better-auth-with-pbkdf2.md)、[ADR-0026](0026-csp-with-nonce-from-proxy-and-headers-file.md)、[ADR-0028](0028-first-migration-conventions-and-test-db.md)

## 背景

- #26 は「ユーザー作成と認証ライブラリの行の作成は 1 つのトランザクション」を求める。D1 は対話的なトランザクションが使えず（ADR-0019）、Better Auth の Drizzle アダプターは `transaction` が既定で無効なので、`signUpEmail` は利用者・アカウント・セッションを別々の文で書く（`@better-auth/drizzle-adapter` 1.7.18 の `transaction: config.transaction ?? false`）。途中で失敗すると、パスワードの無い利用者の行が残りメールアドレスを塞ぐ。
- ADR-0020 は Cookie の有効期間を 604800 秒（7 日）と書いたが、conventions.md と #26 の AC-6 は 30 日（2592000 秒）。
- Better Auth の利用者モデルは `emailVerified` を要求するが、#23 の `users` には無い。
- 保護する画面の判定を `src/proxy.ts` に置くと CSP の担当と混ざる（ADR-0026）。

## 決定

- サインアップ（`signUp`）は、`users`・`accounts`（`providerId = 'credential'`、PBKDF2 + pepper のハッシュ）・`sessions` の 3 行を 1 回の `db.batch` で書く。`signUpEmail` は使わない。UNIQUE 違反は CONFLICT に変換し、事前の SELECT で両方の衝突を一度に返す。
- セッションの Cookie は、Better Auth の署名付き Cookie の形式（`encodeURIComponent(token.base64(HMAC-SHA256(BETTER_AUTH_SECRET, token)))`、名前は https のとき `__Secure-better-auth.session_token`）を `src/features/auth/model/session-cookie.ts` で作る。Better Auth の `getSession` がそれを受け付けることは結合テストで確かめる。読み取り（`getSessionUser` / `requireUser`）は Better Auth の `getSession` を使う。
- 有効期間は 30 日（`SESSION_MAX_AGE_SEC`）。Server Component は更新後の Cookie を返せないので、`disableRefresh` を付け、サインインから 30 日で終わる（延長しない）。ADR-0020 の 7 日の値はこの ADR で置き換える。
- `users` に `email_verified`（INTEGER 0/1、既定 0）を `migrations/0002_auth.sql` で足す。Better Auth のモデルへの対応: `name` → `display_name`、`image` → `avatar_key`、`username` は追加フィールド。テーブルは `sessions`・`accounts`・`verifications`。
- Better Auth の HTTP ハンドラー（`/api/auth/[...all]`）はこの PBI では置かない。置くと `sign-up/email` が検証・レート制限・予約語の検査を通らずに使えるので、#31 が置くときは `sign-up` 系のパスを閉じる（または拒む）。
- ログインが必要な画面は `src/app/(app)/` の下に置き、その `layout.tsx` が `getSessionUser()` で確かめて、無ければ `/accounts/login` へ `redirect` する。URL の一覧は `isProtectedPath()`（`model/protected-paths.ts`）に集め、`src/proxy.ts` は触らない。
- `getSessionUser` の結果の `username` は、ナビへ渡す前に形式を確かめ（`isValidUsernameFormat`）、プロフィールの href は `encodeURIComponent` する。
- E2E の起動の確認 URL は、`/` が未ログインで 302 になるので `/accounts/signup`（200）にする。E2E は `node:sqlite` でスロットの D1 のファイルを開いて、`rate_limits` を空にし行を仕込む。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 自前の `db.batch` + Cookie を署名（採用） | 3 行が全部できるか全部できないか。事前の SELECT で CONFLICT を返し、ハッシュを無駄にしない。ハッシュは 1 回 | Cookie の形式を Better Auth と揃える責任を負う（結合テストで固定） |
| `auth.api.signUpEmail` + 失敗時に利用者を削除 | 部品がそろっている | 3 回の別々の書き込み。削除も失敗しうる。username の UNIQUE が Better Auth の型に無い |
| 自前の `db.batch` の後に `signInEmail` でセッション | Cookie を Better Auth に任せられる | PBKDF2 が 2 回で CPU 時間が 10 ms を超えうる（ADR-0020） |
| 保護を `src/proxy.ts` で行う | 1 か所 | CSP と責務が混ざる。DB を読むミドルウェアは Node.js ランタイムの実験的な機能に依存する（ADR-0026） |

## 結果

- 良くなる: サインアップが途中で失敗しても行が残らない。Cookie の属性は 1 か所（`session-cookie.ts`）。
- 受け入れるコスト: Better Auth を上げるときは、Cookie の署名の形式を結合テスト（`sign-up.int.test.ts`）で確かめる。セッションは延長されない。`rate_limits` の古い窓の行は M3 の掃除のジョブまで残る。
- 守ること: ログインが必要な新しい画面は `(app)` の下に置き、`isProtectedPath` に足す。他の slice は `getSessionUser` / `requireUser` だけを使う。#31 が認証のハンドラーを置くときは上のサインアップの閉じ方を守る。
