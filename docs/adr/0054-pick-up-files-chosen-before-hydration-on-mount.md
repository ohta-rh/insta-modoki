---
type: ADR
title: "ADR-0054: ハイドレーション前に選ばれたファイルはマウント時に取り込み、選択は無効にしない"
description: "ファイル選択はハイドレーションの前でもブラウザ自身の動作で開くので、その時に選ばれたファイルは、マウントの時に 1 回だけ useFilesPickedBeforeHydration で既存の pick に通して取り込む。選択を無効にしたり隠したりはしない。"
tags: [hydration, accessibility, file-input]
status: stable
---

# ADR-0054: ハイドレーション前に選ばれたファイルはマウント時に取り込み、選択は無効にしない

- ステータス: 採用
- 日付: 2026-11-22
- 決定者: エージェント（委任された判断）
- 関連: #78、#80、[docs/research/e2e-keyboard-photo-pick-under-load.md](../research/e2e-keyboard-photo-pick-under-load.md)、[ADR-0014](0014-code-in-feature-slices.md)、[ADR-0048](0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md)、`docs/architecture/conventions.md`「ハイドレーション」

## 背景

- conventions.md「ハイドレーション」は、ファイル選択をブラウザ自身の動作（`<input type="file">`）で作ると決めており、選択画面はハイドレーションの前でも開く（`e2e/post-create.spec.ts` と `e2e/media-upload.spec.ts` の「JS の読み込み前でも」のテストが確かめている）。
- しかし選んだ結果は React の `onChange` だけで取り込んでいた。ハイドレーションの前に起きた `change` は React に届かず、写真は `input.files` に残ったまま状態に入らない。表示は「0 / 10 枚」で `alert` も出ない（#78 の調査の手順 2: `{"items":0,"counter":"0 / 10 枚","inputFiles":1}`）。
- 同じ形の `<input type="file">` が `CreatePostForm`・`ImagePicker`・`AvatarField` の 3 つにある。
- 3 つの `pick` は、最初の `await` より前に同期で `input.value = ''` を実行する。

## 決定

- 3 つの入力で、ハイドレーションの前に選ばれたファイルを、マウントの時に 1 回だけ、既存の `pick` に通して取り込む。`src/shared/ui/files-picked-before-hydration.ts` の `useFilesPickedBeforeHydration(ref, pick)` を使い、判定は純粋な `filesPickedBeforeHydration(input)` に分ける。
- `pick` は最初の `await` より前に同期で `input.value = ''` を実行する。この条件で、StrictMode の 2 回目の effect や、ハイドレーション直後に `onChange` が先に動いた場合でも、同じファイルを 2 回取り込まない。条件は JSDoc に書く。
- エラーと空の状態は、ハイドレーション後に選んだときと同じ表示を使う。何も選んでいなければ何もしない。
- ハイドレーションが済むまで選択を無効にしたり隠したりはしない。名前、Tab の順、フォーカスは変えない。
- conventions.md「ハイドレーション」に、この取り込みの決まりを 1 文で足す。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| マウント時に `files` を読んで取り込む（採用） | 選択をハイドレーション前に開けたまま、選んだ写真を失わない。既存の `pick` と表示を再利用できる | `pick` が最初の `await` の前に入力を空にする条件を守り続ける必要がある |
| ハイドレーションが済むまで選択を無効にする・隠す | 実装が単純 | 「ブラウザ自身の動作で作る」の決まりに反し、既存の 2 つのテストを壊し、遅い回線では選ぶ操作そのものを待たせる |
| ネイティブの `change` をマウント前から捕まえる（インラインのスクリプト） | 取りこぼしが無い | CSP とスクリプトの置き場が増え、React の外に状態の経路が増える |

## 結果

- 遅い回線や負荷の高いホストで、ハイドレーションの前に選んだ写真が一覧・プレビューに入る。`e2e/keyboard.spec.ts` の取りこぼしの原因も消える。
- コストは、3 つの呼び出しと `pick` の同期的な空にする条件。
- 今後、`<input type="file">` を `onChange` で取り込むときは `useFilesPickedBeforeHydration` を使う（M3 のストーリーの作成画面は別の bug PBI で直す）。
