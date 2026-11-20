---
type: ADR
title: "ADR-0014: コードは機能ごとの slice（src/features/<name>/）と共有の部分（src/shared/）に分ける"
description: "機能のコードは src/features/<name>/ に、複数の機能が使う部品は src/shared/ に置く。機能をまたぐ呼び出しは slice の公開する入口だけを通す。PBI の触るファイルを slice の単位で書き、並列の PBI が衝突しないようにする。"
tags: [architecture, parallel]
status: stable
---

# ADR-0014: コードは機能ごとの slice（src/features/<name>/）と共有の部分（src/shared/）に分ける

- ステータス: 採用
- 日付: 2026-11-20
- 決定者: エージェント（委任された判断）
- 関連: [ADR-0005](0005-map-dependencies-for-parallel-work-at-filing.md)、[ADR-0013](0013-four-milestones-local-mvp-then-cloudflare.md)

## 背景

ADR-0005 では、PBI ごとに触るファイルを起票の時点で書き、同じ Wave の PBI のファイルが重ならないようにすると決めた。しかし、フレームワークはまだ決まっていない。フレームワークは A1 の PBI で決める。ディレクトリの構成が決まっていないと、触るファイルを書けない。ファイルを層（components / services / repositories）で分けると、1 つの機能の変更がいくつもの共有ディレクトリにまたがり、並列の PBI が同じファイルを触る。

## 決定

- 機能のコードは `src/features/<name>/` に置く。UI・サーバーの処理・DB へのアクセス・テストは、その機能の slice の中に置く。
- 複数の機能が使う部品は `src/shared/` に置く。たとえば DB の接続とスキーマの入口、ストレージ、UI の部品とトークン、セキュリティ。
- 機能をまたぐ呼び出しは、slice が公開する入口（`index.*`）だけを通す。
- ルーティングのファイル（フレームワークの規約の場所）は薄く保ち、slice を組み合わせるだけにする。
- マイグレーションは PBI ごとに新しいファイルを足す。
- フレームワークの規約と衝突するときは、A1 の PBI で、この ADR を置き換える ADR を書く。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 機能の slice + shared（採用） | PBI の触るファイルが slice ごとに分かれ、並列にしやすい | 機能をまたぐ部品をどこに置くかの判断が要る |
| 層で分ける | よく知られた形 | 1 つの PBI が複数の共有ディレクトリを触り、衝突する |
| フレームワークの決定まで構成を決めない | A1 に任せられる | 起票の時点で触るファイルを書けない |

## 結果

- 各 PBI の「触るファイル」は、slice とルートの単位で書かれている。
- code-reviewer は、slice の入口を通らない呼び出しと、ルーティングのファイルに置かれたロジックを指摘する。
