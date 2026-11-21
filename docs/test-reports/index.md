# 試験レポート

EPIC の総合試験（実ブラウザ）のレポート。書き方は [ADR-0012](../adr/0012-epic-integrated-test-in-real-browser.md)。画面の写真とログは `evidence/epic-<NNNN>/` に置く。

# EPIC の総合試験

* [EPIC #1 開発基盤の総合試験（1 回目、FAIL）](epic-0001-dev-foundation.md) - f50238c。AC-6（存在しない静的ファイルの 404 にセキュリティヘッダーが無い）で FAIL。#72 で直してやり直す
* [EPIC #1 開発基盤の総合試験（2 回目、PASS）](epic-0001-dev-foundation-r2.md) - 36da85b。#72 の修正で AC-6 が満たされ、7 つの AC が全て PASS
* [EPIC #2 アカウントの総合試験（1 回目）](epic-0002-account-signup-login.md) - 379a2fb。PASS（AC-4 の Secure は ADR-0030 により https のときだけ。結合テストで確かめた）
* [EPIC #3 プロフィールの総合試験（1 回目）](epic-0003-profile.md) - 20d04dd。PASS（ヘッダーのアイコンの alt="" は隣に名前がある飾りとして正しい、と Director が判定）
* [EPIC #4 投稿の総合試験（1 回目、FAIL）](epic-0004-post-create-detail.md) - ddda5d8。6 つの AC の中身は満たしたが、投稿詳細の「削除」でコンソールに警告 1 件（`showModal` の二重呼び出し）が出る
* [EPIC #6 リアクションの総合試験（1 回目、PASS）](epic-0006-reactions-like-comment.md) - 18c2158。7 つの AC が全て PASS。コンソールの警告・エラーと失敗した通信は 0（AC-3 で起こした失敗を除く）
