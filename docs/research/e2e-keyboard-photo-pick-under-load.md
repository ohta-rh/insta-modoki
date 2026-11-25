---
type: Research
title: 負荷のあるホストで e2e/keyboard.spec.ts:34 が落ちる原因の調査
description: 写真を選ぶ操作がハイドレーション前に行われると選んだ写真が黙って捨てられる、という製品の不具合を決定的に再現した記録。CPU を遅くする自然な再現は 100 回中 0 回。2026-11-22 時点（#78）。
tags: [research, e2e, hydration, post-create]
status: stable
---

# 負荷のあるホストで e2e/keyboard.spec.ts:34 が落ちる原因の調査

2026-11-22 の調査（#78 AC-5）。対象は `e2e/keyboard.spec.ts:34`（`setFiles` の後、`listitem`「写真 N」が 5 秒で 1 件にならない）が、負荷の高いホストで 2 回落ちたこと。製品のコードは変えていない。測定に使った spec は `e2e/zz-probe.spec.ts`（commit しない）で、下の「再現の手順」に要点を書く。

# 結論

根本原因（一文）: `CreatePostForm.tsx` の `<input type="file" onChange={pick}>` は、ハイドレーションの前でも OS の選択画面が開く（178 行目のコメントどおり）のに、その前に届いた `change` を React が受け取らず、選んだ写真は `<input>` の `files` に残ったまま状態（`photos`）に入らないので、画面は「0 / 10 枚」のまま、エラーも出さずに捨てられる（確定。決定的な再現は手順 2）。

落ちた時点の画面（`0 / 10 枚`・`fieldset` が無効でない・`alert` が空）は、この原因で説明がつく。ただし、その落ち方を CPU の遅延では自然に再現できなかった（手順 1）ので、「あの 2 回の失敗がまさにこの原因だった」とまでは確定していない（仮説のまま。失敗時の画面が `pick()` の一度も呼ばれていない状態と一致する、というところまでが事実）。利用者から見れば、スクリプトの届くのが遅い回線・端末で、選んだ写真が黙って消える製品の不具合であることは、決定的な再現で確定した。

# 手順 1: CPU の遅延での再現（自然な落ち方）

`e2e/keyboard.spec.ts` の 9〜34 行目の写し。`page.on('request')` で `resourceType() === 'document'` の URL を集め、`setFiles` の直前に `html[data-hydrated="1"]` の数を数え、`Emulation.setCPUThrottlingRate` で CDP から CPU を遅くした。`PORT=3103 pnpm exec playwright test e2e/zz-probe.spec.ts -g "keyboard spec copy" --project=chromium --workers=1 --repeat-each=20`（`pnpm build` 済みのスロット 3、ホストの load average 7〜14）。

| CPU の遅さ | 回数 | 落ちた | `/create` が文書として読み込まれた | `setFiles` の時点でハイドレーション済み |
|---|---|---|---|---|
| 1 倍（遅くしない） | 20 | 0 | 20 | 20 |
| 6 倍 | 20 | 0 | 20 | 20 |
| 20 倍 | 20 | 0 | 20 | 20 |
| 40 倍 | 20 | 0 | 20 | 20 |
| 1.5 倍 + ホストの全コアを `yes` 32 本で埋める | 20 | 0 | 20 | 20 |

読み取れること:

- どの回も、文書として読み込まれた URL は `['/accounts/signup', '/create']` の 2 つ。サインアップ後の `/` は文書の読み込みではない。一方「投稿」のリンクを Enter で押した `/create` は毎回文書の読み込みで、そこで新しくハイドレーションが始まる。つまり H1 の前半（`/create` がハイドレーション前の文書として出る）は毎回成り立つ。
- 一方、`setFiles` の時点では 100 回中 100 回ハイドレーションが済んでいた。ブラウザの CPU を遅くしても、`tabTo` の Tab の往復（CDP の呼び出し）もそれ以上に遅くなるので、ハイドレーションより先に `setFiles` が届く競争にはならない。落ちる条件は、ページの JS の実行ではなく、スクリプトの配信がテストの操作より遅れること（アプリのサーバーが負荷で遅い）と考えられるが、この調査では自然な形では起こせなかった（仮説）。

# 手順 2: H1 の決定的な確かめ（`holdScripts`）

`e2e/support/hydration.ts` の `holdScripts` で `_next/static/chunks/**` を止めたまま、サインアップ済みのページで `/create` を `waitUntil: 'commit'` で開き、`写真を選ぶ` に Tab で移って Enter、`setFiles` で JPEG（800x600）を 1 枚渡し、止めた script を放し、`waitForHydration` と 1.5 秒の後に数える。

```
{"h1":true,"hydratedBeforeSetFiles":0,"items":0,"counter":"0 / 10 枚","inputFiles":1}
```

- `hydratedBeforeSetFiles: 0` — 選んだ時点でハイドレーション前だった。
- `inputFiles: 1` — ブラウザの `<input>` は写真を持っている。
- `items: 0`・`counter: "0 / 10 枚"` — ハイドレーションが済んでも、状態には入らず、`alert` も出ない。

これは `e2e/keyboard.spec.ts:34` の失敗時の画面（`0 / 10 枚`、`pick()` が一度も動いていない）と同じ状態で、H1 の後半が確定した。

# 再現の手順

1. `pnpm build` の後、スロットで `PORT=<ポート> pnpm exec playwright test` を使う。
2. 手順 1: `e2e/keyboard.spec.ts:9-34` を写し、`page.on('request', r => r.resourceType() === 'document' && docs.push(new URL(r.url()).pathname))`、`setFiles` の直前の `await page.locator('html[data-hydrated="1"]').count()`、先頭の `const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate })` を足し、結果を 1 行の JSON で書く。`--repeat-each=20 --workers=1`。
3. 手順 2: `signUpViaUi` → `makeJpeg`（スクリプトを止める前に作る。`page.evaluate` はスクリプトが止まったページでは使えない）→ `holdScripts` → `page.goto('/create', { waitUntil: 'commit' })` → `tabTo(写真を選ぶ)`・Enter → `setFiles` → `release()` → `waitForHydration` → 数える。

# 次にすること

製品の不具合として bug PBI を 1 件（#4 の下）: ハイドレーション前に選んだ写真を、ハイドレーション後に取り込む（`input.files` を読む）、またはハイドレーション前は選択を出さない。最初に落とすテストは手順 2（`holdScripts` を使い、`1 件` になることを期待する）。`e2e/keyboard.spec.ts` は変えない。
