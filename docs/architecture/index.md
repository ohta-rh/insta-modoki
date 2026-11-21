# アーキテクチャ

PBI の「実装方針」が参照する、今の設計の決まり。技術スタックは #18 で決まり（[ADR-0018](../adr/0018-nextjs-on-workers-via-opennext.md) から [ADR-0022](../adr/0022-testing-ui-and-package-management.md)）、[overview.md](overview.md) に反映した。

# 設計

* [システムの全体像と技術構成](overview.md) - 全体の図、ローカルと本番の対応、環境変数、コマンド名、ルートのファイルの場所、後続の PBI への確定表
* [データモデル](data-model.md) - 全機能のテーブル・列・制約・インデックス・削除の連鎖
* [画面の URL とサーバーの処理](routes.md) - URL、処理の名前・入力・出力・エラー、予約したユーザー名
* [実装の共通の決まり](conventions.md) - slice の構成、テストの置き場所と名前、エラー、カーソル、上限、削除
* [デザインシステム](design-system.md) - 色・余白・文字のトークン、自作のロゴとアイコン、禁止語、色の使い方、画面の骨格（ナビ）
