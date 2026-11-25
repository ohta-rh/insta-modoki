---
type: ADR
title: "ADR-0061: 作成のモーダルは、ルートのレイアウトの modal スロットの intercepting route で開く"
description: "ナビの「投稿」で /create をモーダルとして重ねるとき、[username] の下に intercepting route を置くと /create が username「create」として解決され、後ろのプロフィールが消える。そこでルートのレイアウトに modal スロットを足し、(.)create と全ての他の URL を空にする [...rest] を置く。"
tags: [architecture, ui]
status: stable
---

# ADR-0061: 作成のモーダルは、ルートのレイアウトの modal スロットの intercepting route で開く

- ステータス: 採用
- 日付: 2026-11-23
- 決定者: エージェント（委任された判断。Director が追認）
- 関連: ADR-0043 / #92 / #87

## 背景

- #92 は、ナビの「投稿」を押すと `/create` が見ている画面の上にモーダルで開くことを求める。ADR-0043 の形（intercepting route。直接開く・再読み込みは通常のページ）を使う。
- issue の実装方針は、`src/app/(app)/@modal/(.)create/page.tsx`（`(app)` の画面の上）と `src/app/[username]/@modal/(..)create/page.tsx`（プロフィールの上）の 2 か所に置くとしていた。
- 2 つ目を実装して実測すると、プロフィールからナビの「投稿」を押したとき、`main` の中にはモーダルだけが残り、後ろのプロフィールが消えた（`e2e/visual-create-modal.spec.ts` › `プロフィールの上でも作成のモーダルが開く` で、`@<ユーザー名>` が見つからない）。`/create` が動的な `[username]` にも当てはまり、ルーターが `[username]` を `create` として組み直し、`children` の中身が捨てられるため（原因は実測から推した仮説で、Next.js 内部までは確かめていない。`(..)p/[postId]` は 2 段のパスなので同じ現象が出ない）。
- スロットは、URL が合わないとき前に描いていた中身を保つ。投稿に成功して `/p/<id>` に移ってもモーダルが残った（`シェアすると投稿され、投稿の画面に移る` が、投稿の画面に書き込み欄の textarea が残って失敗した）。

## 決定

- ルートのレイアウト `src/app/layout.tsx` に `modal` スロットを足し、`{children}` の後ろに描く。
- `src/app/@modal/` に次の 3 つを置く。
  - `(.)create/page.tsx`: `/create` を intercept して `CreatePostModal` を描く。セッションが無ければ `null`。
  - `default.tsx`: 何も描かない（直接開く・再読み込み・モーダルが無い画面）。
  - `[...rest]/page.tsx`: 他の全ての URL で `null` を描き、前のモーダルを閉じる。
- `src/app/(app)/@modal`（ストーリーのビューア）と `src/app/[username]/@modal`（投稿のモーダル）は変えない。`(app)/create/page.tsx` も変えない（直接開く・再読み込み・スクリプトの前は 1 ページのフォーム）。
- issue の 2 か所（`(app)/@modal/(.)create`、`[username]/@modal/(..)create`）には置かない。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| issue の 2 か所に置く | ADR-0043 の置き方と同じ。ファイルが増えない | プロフィールの上では後ろのプロフィールが消える（実測）。`[username]/(..)create` は prerender でも失敗し `force-dynamic` が要る |
| `(app)` だけに置き、プロフィールでは開かない | 構成が単純 | プロフィールの上で開く AC-2 を満たせない |
| ルートの `@modal` に 1 か所（採用） | 全ての画面で同じ 1 つの経路。プロフィールの `children` が消えない。`/p/<id>` の上でも開く | ルートのレイアウトに `modal` が増える。`[...rest]` が要る |
| プロフィールのページ側で `create` を扱う | 後ろの画面を作り直せる | #93 が触るファイルに入る。ユーザー名の予約語の扱いと食い合う |

## 結果

- ナビの「投稿」は、`(app)` の画面・プロフィール・`/p/<id>` など、どの画面でも見ている画面の上にモーダルを開く。issue が対象外にしていた `/p/<id>` の上でも開く（無害なので受け入れる）。
- 3 つの `@modal` は別のレイアウトの別のスロットで、互いに干渉しない。ストーリーは `(app)` の、投稿はプロフィールの、作成はルートのスロットが受け持つ。
- `[...rest]` が、スロットの古い中身を消す役を持つ。これが無いと投稿のあともモーダルが残る。ルートのスロットに新しい intercepting route を足すときも `[...rest]` はそのまま要る。
- `/create` を予約語として `[username]` から外している既存の決まり（`routes.md`）は変えない。
- 守ること: 作成のモーダルを別の場所に移さない。移す場合はこの ADR を置き換える。
