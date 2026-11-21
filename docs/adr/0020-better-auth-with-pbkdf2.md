---
type: ADR
title: "ADR-0020: 認証は Better Auth（メールとパスワード、DB のセッション）にし、ハッシュは PBKDF2-SHA256 に差し替える"
description: "認証ライブラリは Better Auth 1.7.18。セッションは Cookie（HttpOnly・SameSite=Lax）と D1 のセッション、パスワードのハッシュは Web Crypto の PBKDF2-SHA256 100,000 回。Auth.js と自前の実装は退ける。"
tags: [architecture, auth, security]
status: stable
---

# ADR-0020: 認証は Better Auth（メールとパスワード、DB のセッション）にし、ハッシュは PBKDF2-SHA256 に差し替える

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: [調査](../research/stack-selection.md)、#18、[ADR-0011](0011-deploy-to-cloudflare-free-tier-first.md)、[ADR-0018](0018-nextjs-on-workers-via-opennext.md)、[ADR-0019](0019-d1-and-drizzle.md)

## 背景

Workers の無料のプランは 1 リクエストの CPU 時間が 10 ms。Better Auth の既定のハッシュは scrypt で、試作では workerd で約 37 ms（基準を引いた値。リクエスト全体で 41.5 ms）、Node.js で 51.1 ms と、上限を超えた。Web Crypto の PBKDF2-SHA256 は、反復 100,000 回で workerd のハッシュだけが約 7 ms、Node.js で 9.7 ms だった。反復は 100,000 回で試した（Workers の Web Crypto の文書に反復の上限の記述は無く、これより大きい値は試していない）。試作で、サインアップ・ログアウト・ログイン・保護したページ（ログイン前は 302、後は 200）が通り、`Set-Cookie` に `HttpOnly` と `SameSite=Lax` が付いた。

## 決定

- 認証は Better Auth（1.7.18）にする。メールとパスワードで、セッションは Cookie `better-auth.session_token`（`HttpOnly`・`SameSite=Lax`・`Max-Age=604800`）と D1 の `sessions` の行で持つ。
- ハンドラーは `src/app/api/auth/[...all]/route.ts`。リクエストごとに `betterAuth(...)` を、D1 のバインディングを渡して作る。
- パスワードのハッシュは、`emailAndPassword.password.hash` と `verify` で Web Crypto の PBKDF2-SHA256、反復 100,000 回、16 バイトのソルトに差し替える。形式は `pbkdf2-sha256$<反復>$<ソルト>$<ハッシュ>`（base64）。既定の scrypt は使わない。
- Better Auth のテーブルは `users`・`sessions`・`accounts`・`verifications` の名前で D1 に置き、`users.id` を参照させる（[data-model.md](../architecture/data-model.md)）。`username` などの列は `additionalFields` で足す。
- スクリプトからのユーザーの登録は `auth.api.signUpEmail({ body: { name, email, password } })`。
- Better Auth の POST は `Origin` の検査があるので、`baseURL` を環境変数 `BETTER_AUTH_URL` で渡す。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| Better Auth + PBKDF2 に差し替え（採用） | 試作で動いた。DB のセッション・メールとパスワード・スクリプトからの登録の API がある。ハッシュを差し替えられる | 反復が 100,000 回で、一般に推奨される回数より少ない（試作で確かめた値。10 ms に収める必要から選んだ）。サインアップとログインのリクエスト全体はローカルで約 11 ms と 10 ms に届く |
| Better Auth の既定の scrypt | 既定のまま使える | 無料枠の CPU 時間 10 ms を超える（37 ms 以上） |
| Auth.js | 広く使われている | Credentials プロバイダーは既定でデータを DB に持たず、公式はパスワードより OAuth・メールのリンク・Passkey を勧める。このプロジェクトはパスワードのログインが要る |
| Web Crypto での自前 | 依存が無く、CPU 時間を最小にできる | セッション・Cookie・CSRF・レート制限を全て自作し、セキュリティの欠陥を自分で抱える |

## 結果

- M2 のデプロイで、サインアップとログインの CPU 時間を `wrangler tail` などで実測する。10 ms を超えるなら、反復を減らすか有料のプランにするかの判断になり、どちらも ADR-0011 を超えるのでユーザーが決める。
- 反復の回数を変えるときは、保存したハッシュに反復を含めてあるので、古いハッシュはそのまま検証できる。
- code-reviewer と security-reviewer は、Cookie の属性、`Origin` の検査、ハッシュの形式を確かめる。
