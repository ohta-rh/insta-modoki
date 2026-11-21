---
type: ADR
title: "ADR-0030: 認証は Better Auth と PBKDF2-SHA256 + pepper のまま、セッションは 30 日・延長なしにし、users に email_verified を足す（ADR-0020 を置き換える）"
description: "ADR-0020 の決定（Better Auth、PBKDF2 100,000 回 + pepper の HMAC、定数時間の verify、consume() のレート制限、cf-connecting-ip、Secure Cookie）を引き継ぎ、セッションの有効期間を 30 日・延長なし、Cookie の名前、users.email_verified を決める。"
tags: [architecture, auth, security]
status: stable
---

# ADR-0030: 認証は Better Auth と PBKDF2-SHA256 + pepper のまま、セッションは 30 日・延長なしにし、users に email_verified を足す（ADR-0020 を置き換える）

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: #26、[ADR-0020](0020-better-auth-with-pbkdf2.md)（これで置き換える）、[ADR-0029](0029-signup-writes-rows-in-one-db-batch.md)、[ADR-0019](0019-d1-and-drizzle.md)

## 背景

ADR-0020 は Cookie の有効期間を 604800 秒（7 日）と書いたが、conventions.md と #26 の AC-6 は 30 日（2592000 秒）。Server Component は更新後の Cookie を返せないので、Better Auth のセッションの延長（`updateAge`）は使えない。Better Auth の利用者モデルは `emailVerified` を要求するが、#23 の `users` には無い。ADR-0020 の根拠（無料枠の CPU 時間 10 ms での PBKDF2 の計測、OWASP の推奨との差）は変わらない。

## 決定

ADR-0020 から変えない決定:

- 認証は Better Auth（1.7.18）。メールとパスワードで、セッションは Cookie と D1 の `sessions` の行で持つ。Cookie は `HttpOnly`・`SameSite=Lax`、アプリの URL（`BETTER_AUTH_URL`）が https のときは `Secure`。
- パスワードのハッシュは Web Crypto の PBKDF2-SHA256、反復 100,000 回、16 バイトのソルトに、`HMAC-SHA256(鍵 = AUTH_PEPPER, データ = PBKDF2 の出力)` を掛ける。形式は `pbkdf2-sha256-hmac$<反復>$<ソルト>$<ハッシュ>`（base64）。既定の scrypt は使わない。反復は 600,000 回（OWASP）より少ないことを承知で受け入れ、M2 の実測で CPU 時間に余裕があれば増やす（反復はハッシュに入っているので古いものも検証できる）。`AUTH_PEPPER` のローテーションは形式の版を足して行う。
- `verify` は `crypto.subtle.verify("HMAC", ...)` で定数時間に比べる。`===` は使わない。
- Better Auth の組み込みのレート制限は無効にし、`consume()`（D1 の `rate_limits`）で行う。IP は `cf-connecting-ip` だけから取り（`X-Forwarded-For` は使わない）、無ければ `local`。ログインにはメール単位の制限も足す（`consume('login:email:<小文字にしたメール>', 10, 3600)`）。
- Better Auth のテーブルは `users`・`sessions`・`accounts`・`verifications`。`username` は追加フィールド。ハンドラーの `Origin` の検査のために `baseURL` を `BETTER_AUTH_URL` で渡す。

変える決定:

- セッションの有効期間は 30 日（`Max-Age=2592000`）。延長しない（`getSession` に `disableRefresh` を付ける）ので、サインインから 30 日で終わる。ADR-0020 の 7 日はこの値で置き換える。
- Cookie の名前は `better-auth.session_token`、https のときは `__Secure-better-auth.session_token`。
- `users` に `email_verified`（INTEGER 0/1、既定 0）を `migrations/0002_auth.sql` で足す。Better Auth のモデルへの対応は `name` → `display_name`、`image` → `avatar_key`。
- スクリプトからのユーザーの登録（#36）の API は `auth.api.signUpEmail` のままにできるが、アプリの画面の `signUp` は使わない（[ADR-0029](0029-signup-writes-rows-in-one-db-batch.md)）。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| ADR-0020 を引き継ぎ、30 日・延長なしにする（採用） | AC と conventions.md に合う。Server Component で書き込みの失敗が無い | 利用し続けても 30 日で切れる |
| 7 日のまま | ADR-0020 のまま | #26 の AC-6 と conventions.md に反する |
| 30 日で `updateAge` の延長を使う | 使い続ければ切れない | 延長した Cookie を Server Component が返せず、DB と Cookie の期限がずれる |
| `email_verified` を足さず Better Auth の設定で外す | 列が増えない | Better Auth の利用者モデルは必須で、外せない |

## 結果

- セッションの規則の出典はこの ADR になる。ADR-0020 は `deprecated`。
- 受け入れるコスト: セッションは延長されない。`email_verified` は M1 では使わない列として残る。
- code-reviewer と security-reviewer は、Cookie の属性・名前・`Origin` の検査・ハッシュの形式を確かめる。
