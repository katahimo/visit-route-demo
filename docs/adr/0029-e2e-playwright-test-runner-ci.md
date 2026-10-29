# ADR-0029：e2e を @playwright/test で包んで並列に走らせ、PR・夜間の CI で回す

- 日付：2026-10-19
- 状態：採用（包みの中身は ADR-0041）
- 関連：PRD D15、design.md §4 deploy、AGENTS.md のコマンド

## 背景
本物のブラウザで確かめる e2e は `scripts/e2e-*.cjs` の手書きの Playwright のスクリプト（約20本）で、1本ずつ順に走らせ、結果は `OK  `／`NG  ` の行と終了コードで出していた。
- 1本ずつ順に走らせると遅い（4本ずつ同時だと約2.6倍速い。マシンは4コア）
- ほぼ全部のファイルに、Playwright の読み込み・`check`・「今」の計算・出力先・終わり方が重なっている
- 速さの上限（`PERF_MS`）がスクリプトごとに既定が違い、1つの値をまとめて渡せない。出力先を共有すると失敗のスクリーンショットが同じ名前でぶつかる
- CI は main への push で lint → vitest → build → Pages だけで、e2e は人が手元で走らせるだけだった

制約：確かめの名前（AGENTS.md・ADR・design.md が引く）と中身は変えない。単独で `node scripts/e2e-*.cjs` も走らせ続けられること。アプリの動きは変えない。

## 選択肢
| 案 | 長所 | 短所 | 採否 |
|---|---|---|---|
| 自前の並列ランナー | 依存が増えない | 再試行・報告・時間切れ・webServer を自前で作り保つ | 不採用 |
| vitest の browser mode | テストの道具が1つ | Playwright の API（mouse・clock・route・CDP）を直に使うので書き直しが大きい。複数の文脈・タブの扱いが弱い | 不採用 |
| Cypress | 画面で追いやすい | 1つのタブ・同じ源の制約で、別のタブの書き換え・filechooser・CDP の IME を確かめられない | 不採用 |
| `@playwright/test` を依存に入れず手元の外部パスで使う | 依存が増えない | CI で版がそろわない | 不採用 |
| devDependency にして今のスクリプトを包む | スクリプトを捨てずに並列・報告・CI が手に入る。版を lock で固定 | 手元の Playwright と版をそろえ続ける | 採用 |

## 決定
`@playwright/test` を devDependency（版を固定）に入れ、今のスクリプトを包むランナーにする。ADR-0029 以前の「Playwright を npm の依存に入れない」は置き換える。

- 共通の部品は `scripts/lib/env.cjs`（Playwright の読み込み・`launch`・BASE・出力先・FAKE_NOW・NOW・TODAY・`check`・`settle`・`run`／`finish`）に寄せる。失敗のスクリーンショットは `<名前>-fail-<段階>.png`（出力先を共有してもぶつからない）
- ページの時計は止めて「今日」を固定する。ただし速さを測る確かめは、`setFixedTime` が requestAnimationFrame・`performance.now` も差し替えて本物の描画を待たなくなるので、時計を止めない文脈（`withRealClock`）で測る。速さの上限はスクリプトごとの名前（`PERF_MS_COMPAT` など。無ければ `PERF_MS`）
- 包みは `playwright.config.ts` と `e2e/legacy.spec.ts`：スクリプト1本を1つの test にし、`fullyParallel`・worker は手元4・CI 3。サイトは `BASE` があればそれ、無ければ webServer が build して `vite preview` で出す。「今日」（`FAKE_NOW`）は設定ファイルで1回だけ決めて全 worker で同じにする。速さを見るスクリプトは `@perf` を付け、project `perf`（worker 1）で別に走らせる（同時に走ると速さが揺れる）
- コマンドは `npm run e2e`・`npm run e2e:perf`・`npm run e2e:all`
- CI：`.github/workflows/e2e.yml` を PR・手動・夜間（日本時間 03:00）に走らせる。速い検査（lint・型・`check:code`・vitest）、e2e（`--shard` で4つのジョブ）、perf（1本ずつ）の3種類のジョブを並列に。ブラウザと依存は Playwright の公式イメージ（`@playwright/test` と同じ版）に入っているものを使い、毎回インストールしない。ビルドと `vite preview` はジョブごとに1回だけ。夜間は `FAKE_NOW` を次の水曜と月末近くの水曜（2026-10-28・2026-12-30）でも走らせる（月末そのものの最終日・土日は「今日より後の日」が要る test と両立しないので避ける）。速さの上限は共有ランナーが遅いので CI で緩める（大きな遅れの検出だけ。細かな速さは手元で見る）。公開（`deploy.yml`）はまだ e2e を待たない
- 開き直しは about:blank を挟む（同じ文書で `?id=` へ移すと、読み直す前にアプリが `?id=` を消して欄が開かないことがあるため）。filechooser の受け口はページを開いた直後に付ける
- 段（steps）を出して `test.step`・`expect.soft` で報告に出す形は ADR-0041

## 理由とトレードオフ
- 得るもの：手元で `npm run e2e` の1つでビルドと配信から並列の実行までが走る。PR と夜間に CI で回り、月末近くの「今日」も夜間に確かめる。`node scripts/e2e-*.cjs` の単独の実行も今どおり
- 失うもの：devDependency が増える（ブラウザは別。CI は公式イメージで、版を上げるときは e2e.yml のイメージも上げる）。手元の Playwright と版をそろえ続ける。CI の時間（PR ごとに数分。ジョブの数だけランナーを使う）。速さの上限が CI では緩い
- 見直す条件：CI で同じスクリプトがたびたび落ちる（固定の待ちを目印の待ちに替える）。PR の CI が長すぎる（shard を増やす）。e2e が安定したら公開の前に e2e を待たせる。スクリプトを spec に書き直すなら、fixture（文脈・ツアーを見た扱い・確認ダイアログ・時計）にまとめてからスクリプトを消す

## 影響
`playwright.config.ts`・`e2e/legacy.spec.ts`・`scripts/lib/env.cjs`・`.github/workflows/e2e.yml`・AGENTS.md のコマンド・design.md §4 deploy。
