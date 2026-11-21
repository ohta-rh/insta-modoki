# 試験レポート

EPIC の総合試験（実ブラウザ）のレポート。書き方は [ADR-0012](../adr/0012-epic-integrated-test-in-real-browser.md)。画面の写真とログは `evidence/epic-<NNNN>/` に置く。

# EPIC の総合試験

* [EPIC #1 開発基盤の総合試験（1 回目、FAIL）](epic-0001-dev-foundation.md) - f50238c。AC-6（存在しない静的ファイルの 404 にセキュリティヘッダーが無い）で FAIL。#72 で直してやり直す
* [EPIC #2 アカウントの総合試験（1 回目）](epic-0002-account-signup-login.md) - 379a2fb。AC-1・2・3・5 は PASS、AC-4 は http のローカルで Secure が付かない事実を記録し、判定は Director に委ねる
