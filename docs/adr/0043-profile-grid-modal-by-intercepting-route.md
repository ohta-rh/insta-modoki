---
type: ADR
title: "ADR-0043: プロフィールのグリッドからのモーダルは、Next.js の intercepting routes と parallel routes で作る"
description: "[username] のレイアウトの parallel route @modal に (..)p/[postId] を置き、グリッドの Link を押したときだけ投稿をモーダルで出す。直接開く・再読み込みは /p/[postId] の通常のページ。閉じるのは router.back()。削除の知らせは [username] 配下の context で届ける。"
tags: [architecture, routing, profile, post]
status: stable
---

# ADR-0043: プロフィールのグリッドからのモーダルは、Next.js の intercepting routes と parallel routes で作る

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: Director（ルートの仕組み）。実装は #41 の実装者（context での削除の知らせ）
- 関連: [ADR-0014](0014-code-in-feature-slices.md)、[ADR-0031](0031-login-only-screens-in-app-route-group.md)、#41、#28、#32

## 背景

機能 8 は、グリッドの上に投稿詳細を重ね、URL だけ `/p/<postId>` にする（背景を残す）。URL を開き直したときは通常の投稿詳細（#28）になること、閉じたときにグリッドのスクロール位置と読み込み済みの続きが残ることが要る。`/[username]` のレイアウトは `children` を持つ。

実装で分かった制約（`next build`、2026-11-21）:

- `@modal` に `[[...catchAll]]` を置くと「`/[username]` と同じ詳しさのルートが共存できない」で、`[...catchAll]` を置くと「完全なルートに合わないページ」でビルドが失敗する。`@modal` に置けるのは `default.tsx` と intercepting のページだけ。
- `[username]` のレイアウトの下では、モーダルとグリッドは別の木に描かれる。

## 決定

- `src/app/[username]/layout.tsx` が `children` と `modal`（parallel slot）を描く。`@modal/default.tsx` は `null`、`@modal/(..)p/[postId]/page.tsx` が `getPost` の結果を `PostModal` に渡す。投稿が無いときは `AppError.message` をモーダルの中に出す。
- グリッドの項目は `next/link`（`prefetch={false}`、`scroll={false}`）。修飾キーつき・中ボタンのクリックと、JS が読み込まれる前のクリックはブラウザが通常の `/p/<postId>` を開く。直接開く・再読み込みは `[username]` のレイアウトを通らないので intercepting されない。
- 閉じる（Esc・「閉じる」・戻る）は `router.back()`。フォーカスの閉じ込め・`body` のスクロール止め・フォーカスを開いた項目へ戻すのは `PostModal`（クライアント）が行う。
- 削除は、`post` slice の `PostDeletedProvider`（context）で `DeletePostButton` の削除後の動作を差し替える。モーダルは `profile` slice の `ProfilePostsProvider`（レイアウトに置く）へ削除した id を記録し、`router.back()` する。`PostGrid` はその id を一覧から除く（再読み込みなし、読み込み済みの続きは残る）。
- モーダルの中で投稿者のプロフィールへのリンクを押すなど、前の履歴へ戻らずに別のページへ進む場合は、この PBI では対象外（`@modal` に catch-all を置けないため、スロットは前の状態のまま残りうる）。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| intercepting + parallel routes（採用） | URL・履歴・直接開くときの通常ページが仕組みで揃う。背景が外れない | 上記のビルド制約。モーダルとグリッドが別の木 |
| グリッドの状態でモーダルを出し `history.pushState` で URL を変える | 木が 1 つで単純 | 戻る・進むと状態の同期が自前になる。Next のルーターと食い違う |
| `/p/<postId>` を常にページにする（モーダル無し） | 最も単純 | 機能 8 を満たさない |

## 結果

- グリッドの状態とスクロール位置は、モーダルを開閉しても外れない。
- `DeletePostButton` が context を読む形になり、他の画面は今までどおり投稿者のページへ移る。
- `(..)` の段数が正しいことは、ビルドしたアプリへの E2E（`e2e/post-modal.spec.ts`）で確かめ続ける。
