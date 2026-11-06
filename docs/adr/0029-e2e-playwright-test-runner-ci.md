# ADR-0029：e2e を @playwright/test で包んで並列に走らせ、PR・夜間の CI で回す

- 日付：2026-10-19
- 状態：採用（包みの中身は ADR-0041、CI で走らせる時は ADR-0104）

## 背景
e2e は手書きの Playwright のスクリプト（`scripts/e2e-*.cjs`）を1本ずつ順に走らせ、CI では回していなかった。

## 決定
`@playwright/test` を devDependency（版を固定）に入れ、今のスクリプトを包む。
- 共通の部品は `scripts/lib/env.cjs`（読み込み・`launch`・BASE・出力先・FAKE_NOW・`check`・`settle`・`run`／`finish`）。失敗のスクリーンショットは `<名前>-fail-<段階>.png`
- ページの時計は止めて「今日」を固定。速さを測る確かめは `withRealClock` で測る。上限はスクリプトごとの名前（無ければ `PERF_MS`）
- 包み：`playwright.config.ts` と `e2e/legacy.spec.ts`。スクリプト1本＝1 test、worker は手元4・CI 3。`BASE` が無ければ build して `vite preview`。`@perf` は project `perf`（worker 1）
- コマンド：`npm run e2e`・`e2e:perf`・`e2e:all`
- CI：`.github/workflows/e2e.yml` を PR・手動・夜間（日本時間 03:00）に。速い検査・e2e（`--shard` で4つ）・perf を並列。Playwright の公式イメージを使う。夜間は月末近くの「今日」でも走らせる。CI では速さの上限を緩める
- 開き直しは about:blank を挟む。filechooser の受け口は開いた直後に付ける
- 単独の `node scripts/e2e-*.cjs` も走らせ続けられる

## 捨てた案
自前の並列ランナー（保つのが重い）・vitest の browser mode・Cypress（Playwright の API・複数タブを使えない）。

## トレードオフ
- 失うもの：手元の Playwright と版をそろえ続ける。CI の時間
- 見直す条件：CI でたびたび落ちる・PR の CI が長すぎる。安定したら公開の前に e2e を待たせる
