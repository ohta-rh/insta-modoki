---
type: ADR
title: "ADR-0031: ログインが必要な画面はルートグループ (app) に置き、そのレイアウトが未ログインを /accounts/login へ redirect する"
description: "保護は src/proxy.ts でなく src/app/(app)/layout.tsx で行い、URL の一覧は isProtectedPath() に集める。サインアップとログインの画面ではナビを隠す（isAuthScreen）。"
tags: [architecture, auth, routing]
status: stable
---

# ADR-0031: ログインが必要な画面はルートグループ (app) に置き、そのレイアウトが未ログインを /accounts/login へ redirect する

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: #26、[ADR-0026](0026-csp-with-nonce-from-proxy-and-headers-file.md)、[ADR-0030](0030-better-auth-session-and-rate-limit-rules.md)、[routes.md](../architecture/routes.md)

## 背景

`src/proxy.ts` は CSP の担当で（ADR-0026）、Node.js ランタイムのミドルウェアは OpenNext では実験的。画面の保護は、どこかで 1 回、全ての「ログイン: 要」の画面に効く必要がある。サインアップとログインの画面は、ナビを出さない（`AppShell` の `hideNav`）。

## 決定

- ログインが必要な画面は `src/app/(app)/` の下に置く。`layout.tsx` が `getSessionUser()` で確かめ、無ければ `/accounts/login` へ `redirect` する。`/p/[postId]` と `/[username]` は `(app)` の外。
- 保護する URL の一覧は `isProtectedPath()`（`src/features/auth/model/protected-paths.ts`）に集める。新しいログイン必須の画面は `(app)` の下に置き、この一覧にも足す。`src/proxy.ts` は触らない。
- ナビは `isAuthScreen(path)`（`src/shared/ui/nav-items.ts`）が true の `/accounts/signup`・`/accounts/login` で隠す。
- ナビへ渡すユーザー名は形式を確かめた値だけにし、プロフィールの href は `encodeURIComponent` する。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| `(app)` のレイアウト（採用） | ルートの構造で守られ、置き忘れは 404 かログインの画面として見える。proxy と責務が分かれる | 画面ごとに置き場所を守る必要がある |
| `src/proxy.ts` で `isProtectedPath` を見る | 1 か所 | CSP と責務が混ざる。DB を読むミドルウェアは実験的な機能に依存する |
| 各ページで `requireUser` | 単純 | 書き忘れが保護の穴になる |

## 結果

- 未ログインで保護された画面を開くと `/accounts/login` に 302。ログイン画面は #31 が作る。
- 守ること: ログイン必須の新しい画面は `(app)` の下に置き、`isProtectedPath` に足す。レイアウトのコメントとテストで一覧と置き場所を揃える。
