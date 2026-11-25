---
type: ADR
title: "ADR-0029: サインアップは利用者・パスワード・セッションを 1 つの db.batch で書き、Better Auth の signUpEmail とその HTTP ハンドラーは使わない"
description: "D1 では Better Auth のアダプターがトランザクションを使えないので、signUp は users・accounts・sessions の 3 行を自前の db.batch で書き、Cookie は Better Auth の署名の形式で作る。sign-up/email は #31 でも開けない。"
tags: [architecture, auth, database]
status: stable
---

# ADR-0029: サインアップは利用者・パスワード・セッションを 1 つの db.batch で書き、Better Auth の signUpEmail とその HTTP ハンドラーは使わない

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: #26、[ADR-0019](0019-d1-and-drizzle.md)、[ADR-0030](0030-better-auth-session-and-rate-limit-rules.md)

## 背景

- #26 は「ユーザー作成と認証ライブラリの行の作成は 1 つのトランザクション」を求める。D1 は対話的なトランザクションが使えず（ADR-0019）、Better Auth の Drizzle アダプターは `transaction` が既定で無効なので（`@better-auth/drizzle-adapter` 1.7.18 の `transaction: config.transaction ?? false`）、`signUpEmail` は利用者・アカウント・セッションを別々の文で書く。途中で失敗すると、パスワードの無い利用者の行が残りメールアドレスを塞ぐ。
- Better Auth の HTTP ハンドラーの `sign-up/email` は、このアプリの入力の検証・予約語・レート制限を通らない。

## 決定

- `signUp` は、`users`・`accounts`（`providerId = 'credential'`、PBKDF2 + pepper のハッシュ）・`sessions` の 3 行を 1 回の `db.batch` で書く。`signUpEmail` は使わない。
- UNIQUE 違反は CONFLICT に変換する。事前の SELECT で username と email の両方の衝突を一度に返し、ハッシュの計算を無駄にしない。
- セッションの Cookie は `src/features/auth/model/session-cookie.ts` で、Better Auth の署名付き Cookie の形式（`encodeURIComponent(token.base64(HMAC-SHA256(BETTER_AUTH_SECRET, token)))`）に作る。Better Auth の `getSession` がそれを受け付けることを `sign-up.int.test.ts` で固定する。読み取り（`getSessionUser` / `requireUser`）は Better Auth の `getSession` を使う。
- Better Auth の HTTP ハンドラー（`/api/auth/[...all]`）はこの PBI では置かない。#31 が置くときは `sign-up` 系のパスを閉じる（拒む）。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 自前の `db.batch` + Cookie を署名（採用） | 3 行が全部できるか全部できないか。ハッシュは 1 回。入力の検証とレート制限を必ず通る | Cookie の形式を Better Auth と揃える責任を負う（結合テストで固定） |
| `auth.api.signUpEmail` + 失敗時に利用者を削除 | 部品がそろっている | 3 回の別々の書き込み。削除も失敗しうる。username の UNIQUE が Better Auth の型に無い |
| 自前の `db.batch` の後に `signInEmail` でセッション | Cookie を Better Auth に任せられる | PBKDF2 が 2 回で CPU 時間が 10 ms を超えうる（ADR-0020） |

## 結果

- サインアップが途中で失敗しても行が残らない。Cookie の属性は 1 か所（`session-cookie.ts`）。
- Better Auth を上げるときは、Cookie の署名の形式を結合テストで確かめる。
- #31 は、ログインとログアウトのハンドラーを置くときに `sign-up/email` を拒むことを守る。
