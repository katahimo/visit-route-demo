# ADR-0041：e2e を段（test.step）・確かめ（expect.soft）・画面の状態での待ちにし、テストの揺れを止める

- 日付：2026-10-20
- 状態：採用
- 関連：ADR-0029

## 背景
報告が1本単位でどの確かめが落ちたか見えず、固定の待ちで負荷のあるときに落ちていた。スクリプトは残し、単独の実行も続ける。

## 決定
- 段の型（`scripts/lib/steps.cjs`）：スクリプトは `module.exports = { steps }` と、末尾で `if (require.main === module) runSteps(steps)`。`sharedPage`・`pagePerStep`・`guard`
- 1つの段は最長3分。時間切れは NG にして次へ（`sharedPage` では残りの段も NG）
- 包み（`e2e/legacy.spec.ts`）：test ごとにスクリプトを読み直し、段を `test.step`、`check` を `expect.soft` に写す
- trace・動画は落ちたときだけ（`retain-on-failure`。perf は取らない）。`actionTimeout`・`navigationTimeout` は30秒
- 待ち（`settle`）：描画2回のあと、DOM の変化が 50ms 無く、CSS の動きと近いタイマーが残っていないこと。固定の待ちは計測の条件など必要な所だけ
- 相性の速さの関門：ならし3回のあと9回の中央値。超えたら最大3回りまで測り直し一番よい回りで比べる。1回り目が上限の2倍超は落とす。上限は手元 100ms・CI 300ms
- vitest：各 test の前にイベントループを1回まわす（`src/testSetup.ts`）
- 競合の印：`scripts/check-conflict-markers.cjs` を `npm run lint` の最後と e2e.yml の先頭で走らせる

## 捨てた案
spec に書き直す（書き換えが大きい）・1か所ずつ locator の待ちに書き換える。

## トレードオフ
- 失うもの：trace で約2割遅い。`settle` は Worker の計算・ネットワークを待てない（目印で待つ）
- 見直す条件：否定の確かめは目印の待ちに寄せる。spec に書き直すとき段の型を消す
