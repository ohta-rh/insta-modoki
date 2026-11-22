# 試験レポート

EPIC の総合試験（実ブラウザ）のレポート。書き方は [ADR-0012](../adr/0012-epic-integrated-test-in-real-browser.md)。画面の写真とログは `evidence/epic-<NNNN>/` に置く。

# EPIC の総合試験

* [EPIC #1 開発基盤の総合試験（1 回目、FAIL）](epic-0001-dev-foundation.md) - f50238c。AC-6（存在しない静的ファイルの 404 にセキュリティヘッダーが無い）で FAIL。#72 で直してやり直す
* [EPIC #1 開発基盤の総合試験（2 回目、PASS）](epic-0001-dev-foundation-r2.md) - 36da85b。#72 の修正で AC-6 が満たされ、7 つの AC が全て PASS
* [EPIC #2 アカウントの総合試験（1 回目）](epic-0002-account-signup-login.md) - 379a2fb。PASS（AC-4 の Secure は ADR-0030 により https のときだけ。結合テストで確かめた）
* [EPIC #2 アカウントの総合試験（2 回目、PASS）](epic-0002-account-signup-login-r2.md) - 7e81030。ADR-0048 によるやり直し（リファクタ 52a1ddb..836c2e6 の後）。5 つの AC が全て PASS。ログアウト後に古いセッションは残らず、コンソールの警告・エラーと失敗した通信は 0
* [EPIC #3 プロフィールの総合試験（1 回目）](epic-0003-profile.md) - 20d04dd。PASS（ヘッダーのアイコンの alt="" は隣に名前がある飾りとして正しい、と Director が判定）
* [EPIC #3 プロフィールの総合試験（2 回目、PASS）](epic-0003-profile-r2.md) - b74f364。ADR-0048 によるやり直し（リファクタ 52a1ddb..836c2e6 の後）。5 つの AC が全て PASS。28 件のグリッドの無限スクロールに重複・抜けは無く、モーダルのフォーカスは外へ出ない
* [EPIC #4 投稿の総合試験（1 回目、FAIL）](epic-0004-post-create-detail.md) - ddda5d8。6 つの AC の中身は満たしたが、投稿詳細の「削除」でコンソールに警告 1 件（`showModal` の二重呼び出し）が出る
* [EPIC #4 投稿の総合試験（2 回目、PASS）](epic-0004-post-create-detail-r2.md) - 2f2e1c4。#74 の修正で「削除」の警告が消え、6 つの AC が全て PASS。コンソールの警告・エラーと失敗した通信は 0（想定した 404 を除く）
* [EPIC #4 投稿の総合試験（3 回目、PASS）](epic-0004-post-create-detail-r3.md) - eff2d89。ADR-0048 によるやり直し。リファクタ 52a1ddb..836c2e6 の後も 6 つの AC が全て PASS。存在しない・削除済みの投稿のモーダルと通常のページ、削除ダイアログの focus、送信の失敗のメッセージを確かめ、コンソールの警告は 0。削除の失敗後に focus が一度 body に落ちる軽微な挙動を 1 件記録した
* [EPIC #4 投稿の総合試験（4 回目、PASS）](epic-0004-post-create-detail-r4.md) - 265411e。バグ #76（削除ダイアログで通信が失敗したあと focus が body に落ちる）の修正の後も 6 つの AC が全て PASS。投稿・コメントの削除ダイアログは通信中は閉じず二重送信せず、失敗後も Tab・Shift+Tab 5 回ずつ focus が中に留まり、Esc で「削除」に戻る。コンソールの警告は 0
* [EPIC #4 投稿の総合試験（5 回目、PASS）](epic-0004-post-create-detail-r5.md) - c3a4a8e。#80（ハイドレーション前に選んだファイルをマウント時に取り込む。ADR-0054）の後も 6 つの AC が全て PASS。JS を止めた `/create` と Slow 3G で、キーボードで選んだ写真が読み込み後に一覧に入り、投稿でき、二重にならず、11 枚・10MB 超の理由も出る。コンソールの警告は 0。
* [EPIC #6 リアクションの総合試験（1 回目、PASS）](epic-0006-reactions-like-comment.md) - 18c2158。7 つの AC が全て PASS。コンソールの警告・エラーと失敗した通信は 0（AC-3 で起こした失敗を除く）
* [EPIC #6 リアクションの総合試験（2 回目、PASS）](epic-0006-reactions-like-comment-r2.md) - 3e3fd55。ADR-0048 によるやり直し（リファクタ 52a1ddb..836c2e6 の後）。7 つの AC が全て PASS。いいねした人 45 人・コメント 45 件のページ送りに重複・抜けは無く、2 つのダイアログのフォーカスは外へ出ず、JS 無しのフォームも動き、コンソールの警告・エラーと失敗した通信は 0（わざと起こした分を除く）
* [EPIC #5 フィードとフォローの総合試験（1 回目、PASS）](epic-0005-follow-feed.md) - 2f2e1c4。7 つの AC が全て PASS。コンソールの警告・エラーと失敗した通信は 0（失敗の経路で起こした分を除く）
* [EPIC #5 フィードとフォローの総合試験（2 回目、PASS）](epic-0005-follow-feed-r2.md) - 603bd41。ADR-0048 によるやり直し（リファクタ 52a1ddb..836c2e6 の後）。7 つの AC が全て PASS。フィード 48 件・フォロー中一覧 100 件のページ送りに重複・抜けは無く、JS 無しのフォームは未ログインでログインへ移り、コンソールの警告・エラーと失敗した通信は 0（わざと起こした分を除く）
* [EPIC #7 MVP の品質の総合試験（1 回目、PASS）](epic-0007-mvp-quality.md) - 9cd035f。6 つの AC が全て PASS（AC-1・4・5・6 は実 Chrome 157、AC-2・3 は同梱の Chromium の計測）。コンソールの警告・エラーと失敗した通信は 0（AC-1 で起こした 404 を除く）
* [EPIC #7 MVP の品質の総合試験（2 回目、PASS）](epic-0007-mvp-quality-r2.md) - eb2ec7b。ADR-0048 によるやり直し（リファクタ 52a1ddb..836c2e6 の後）。6 つの AC が全て PASS。4 つのモーダルのフォーカストラップは外へ出ず、性能は全て基準以内（フィード LCP 2416・2278ms、p95 は負荷で 120ms の後 33ms、初期 JS 150,797 バイト）

# 計測

* [性能の基準の計測（#45）](perf-2026-11-21.md) - 59186d1。Lighthouse・INP・フィード API の p95・初期 JS が全て基準以内（初期 JS は 183,451 → 150,208 バイトに直した）
