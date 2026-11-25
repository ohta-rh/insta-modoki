---
type: ADR
title: "ADR-0039: いいねの件数は、1 つの db.batch の中で直前の文の changes() だけ増減させる"
description: "likes の行の追加・削除と posts.like_count の更新を 1 つの db.batch に入れ、件数は UPDATE の中で changes()（直前の INSERT / DELETE が実際に変えた行数）だけ動かす。再送・同時の呼び出し・無い投稿でも件数がずれない。いいねした人の一覧を開く件数は、ダイアログの呼び出し属性を持つボタンにする。"
tags: [architecture, database, like]
status: stable
---

# ADR-0039: いいねの件数は、1 つの db.batch の中で直前の文の changes() だけ増減させる

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: #34、[ADR-0019](0019-d1-and-drizzle.md)、[ADR-0014](0014-code-in-feature-slices.md)

## 背景

- `likePost` / `unlikePost` は何度呼んでも同じ結果になり（conventions.md「書き込みの再送」）、`posts.like_count` は `likes` の行の増減と同じトランザクションで動く（data-model.md）。D1 には対話的なトランザクションが無く、複数の書き込みは `db.batch`（1 つのトランザクション）で行う（ADR-0019）。
- 「行が実際に入ったときだけ +1」を、読んでから書く（SELECT → UPDATE）で作ると、同時の呼び出しで件数がずれる。
- いいねした人の一覧は、最初のキー入力で動くべき操作（ダイアログを開く）に当たり、リンクではなく開く先のページも無い（conventions.md「ハイドレーション」）。

## 決定

- `likePost` は `INSERT INTO likes … SELECT … FROM posts WHERE id = ? ON CONFLICT DO NOTHING` と `UPDATE posts SET like_count = like_count + changes() … RETURNING like_count` を 1 つの `db.batch` に入れる。`unlikePost` は `DELETE FROM likes …` と `UPDATE posts SET like_count = max(like_count - changes(), 0) … RETURNING like_count`。`changes()` は直前の文が実際に追加・削除した行数なので、再送・同時の呼び出し・いいねしていない人の取り消しでは 0 動き、返す件数は更新後の行から読む。
- 行の追加は `posts` の行から選んで入れる（INSERT … SELECT）。無い投稿には何も入らず、`RETURNING` が空になるので `NOT_FOUND` にする（外部キーの例外にしない）。
- いいねの件数（「N 件のいいね」）は、リンクではなく、`commandfor` / `command="show-modal"` を持つ `<button>` にして一覧の `<dialog>` を開く。ハートは `<form>` の Server Action で、ハイドレーションの前でも押せる。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| `changes()` を UPDATE の中で使う（採用） | 1 回の往復。件数の更新が行の変化と必ず一致する。同時でもずれない | 文の順序に依存する（バッチの中で INSERT / DELETE の直後に UPDATE を置く）。結合テストで固定する |
| `UPDATE … SET like_count = (SELECT count(*) FROM likes …)` で数え直す | 常に正しい | 人気の投稿でいいねのたびに行を数える |
| SELECT して分岐してから書く | 読みやすい | 同時の呼び出しで件数がずれ、往復も増える |
| 件数を持たず毎回数える | 不整合が起きない | フィードで投稿ごとに COUNT が要り、data-model.md の `like_count` の列を使わなくなる |
| 件数を `<a>` のリンクにする | 見た目が自然 | 開く先のページが無い。ダイアログを開くのはボタンの役割 |

## 結果

- 件数は 10 人の同時のいいねでも 10 になり、同じ人の同時の 10 回でも 1 のまま（`src/features/like/api/like-post.int.test.ts`）。
- コスト: 件数の更新文は、直前の INSERT / DELETE の直後に置く決まりを守る必要がある。間に別の書き込みの文を挟まない。
- 今後いいねやフォローのような「状態にする」処理は、同じ形（行の変更 + `changes()` で件数）で書ける。
