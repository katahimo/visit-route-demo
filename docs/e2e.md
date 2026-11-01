# e2e（本物のブラウザ）の走らせ方・書き方・確かめること

AGENTS.md「コマンド」から引く詳細。e2e を走らせる・足す・直すときだけ読む。決めた理由は ADR-0029・ADR-0041・ADR-0074。

## 走らせ方

- `npm run e2e`（速さを見る5本を除く残りを4本ずつ並列）・`npm run e2e:perf`（速さを見る5本＝compat・nav・progress・vacancy-steps・details を1本ずつ。`e2e/legacy.spec.ts` の `PERF`）・`npm run e2e:all`（e2e のあとに e2e:perf。同時には走らせない）
- 1本だけは `npx playwright test --grep <スクリプトの名前>`（例 `--grep "e2e-details\.cjs"`。部分一致なので `e2e-details` だけでは e2e-details2 も走る）
- サイトは webServer がビルドして `vite preview --port 4183` で出す。4183 で動いている配信があればビルドせずに使い回すので、古いビルドの配信は止めるか、確かめたい配信を `BASE=http://localhost:4183/` で渡す
- 報告は `npx playwright show-report`（落ちた test に記録が付き、`NG  ` の行が見える）。`playwright-report/` と `test-results/` は実行のたびに上書きされるので、e2e の報告は e2e:perf の前に開く
- `node scripts/e2e-xxx.cjs` で1本ずつ単独でも走る（先に `npm run build && npx vite preview --port 4183`）

## 書き方

- スクリプトは段（`[名前, 関数]` の並び）を `module.exports = { steps }` で出し、末尾に `if (require.main === module) runSteps(steps)`。段の型は `scripts/lib/steps.cjs` の `sharedPage`（1つのページを使い回す）・`pagePerStep`（段ごとに新しい文脈）・`guard`。包みは段を `test.step`、`check` を `expect.soft` に写すので、段を足すときは並びに1行足すだけ
- 押したあとの待ちは `settle(page, ms)`（描画・DOM の変化・終わりのある CSS の動き・期限の近いタイマーが落ち着くまで。最長 max(3×ms, 1500ms)）か目印（`locator.waitFor`・`until(fn)`）。`waitForTimeout` は速さの計測・外の遅れ・時間そのものを見る所だけ（前の行に理由と「固定の待ち」と書く）。`E2E_SETTLE_LOG=1` で落ち着かずに最長まで待った所を、`=2` で1回ずつの待った時間を出す（`E2E_SETTLE=fixed` で固定の待ちにして切り分け）
- 1つの段は最長3分（`E2E_STEP_TIMEOUT_MS`）
- 保存した担当の入った訪問を用意する `planDays`（`scripts/lib/plan.cjs`。AI で組むので重い）は、初期データから組む所なら `{ cache: true }`（2回目からは結果の写し。包みの中では `E2E_PLAN_CACHE_DIR`＝`test-results/.plan-cache` で分け合う）
- 落ちた test には trace・動画（perf は取らない）・`-fail-` のスクリーンショット・記録が付く（`npx playwright show-report`・`npx playwright show-trace`）
- 準備は `scripts/lib/steps.cjs` の `openPage`（sharedPage の準備）・`openContext(browser)`（pagePerStep の段ごとの文脈。地図のタイルを止め、確認は `answerConfirms`）を使う。どちらも案内ツアーを見た扱い・時計を `NOW` に止める・ページのエラーを集める（包みが失敗に数える）。自分で文脈を作るときはすぐ `scripts/lib/tourSeen.cjs` の `skipTour(ctx)` を呼ぶ（e2e-tour は除く）。既定（`start: 'all'`）で印 `vrdemo:features:start` = `all`（`scripts/lib/startFeatures.cjs` の `startAll`）を入れ、最初の2問を出さず今の初期データ＋すべて入で始める。2問を確かめるときは `skipTour(ctx, { start: 'ask' })` か呼ばず、`scripts/lib/firstRun.cjs` の `answerFirstRun`・`answerIfAsked` で答える。「デモで試す」で答えると、作った直後に担当なしを1回自動で組む（PRD D409。印 `all` では組まない）ので、`answerFirstRun` は組みの終わりの知らせまで待つ（`waitStartArranged`。終わる前に読み直すと組まれない）。初期データの担当なしが要る確かめ（帯の［担当なしを組む］など）は `{ arranged: false }` で知らせの［元に戻す］を押して組む前に戻す
- 確定の操作を確かめる e2e は「すべて入」（エキスパート入）の前提で書く。「基本」で始めるもの（e2e-tour・e2e-basic-auto・e2e-features・e2e-features2・e2e-simple-menu。2問に答えて始めるのは `scripts/lib/firstRun.cjs` の `openAsked`・`freshAsked`）は確定の印を待たず、日の予定は `plan-summary` を待つ
- 確認に答えるときは `scripts/lib/confirmDialog.cjs` の `answerConfirms(page)`（出た確認の見出しと本文を記録し `answer` のボタンを押す。ネイティブのダイアログは記録して失敗に、beforeunload だけ受ける。答えずにネイティブのダイアログだけ記録するのは `watchNative(page)`）
- 保存を待つ `waitStored(page, pred)`・修飾キー `MOD`・スクリーンショット `shot(page, 名前)` は `scripts/lib/env.cjs` にある（スクリプトに写さない）
- 外部の検索・GAS は `page.route` の偽の応答に差し替え、外へは出さない。地図のタイルは取りに行かない

### 画面の位置を知る共通の手（`scripts/lib/ui.cjs`）

画面の位置（どのボタンがどこにあるか）を e2e の中に直に書かず、次の手を使う。位置が変わったら `ui.cjs` の表（`SCREENS`・`MENU_KEYS`・`TOOLS`）だけを直す。データを書き換えて読み直すだけの出発点には軽いデータの画面（`#/data`）を使う。

- `goTo(page, 行き先, { ready, timeout, h1, settleMs })`：URL で画面へ行く（about:blank を挟む）。行き先は名前（`月`・`週`・`日`・`利用者さん`・`スタッフ`・`設定`・`基本情報`・`組む`・`空き状況`・`欠勤` ほか。表は `SCREENS`）か `/path?query`。各スクリプトの `open` の多くはこれの薄い包み（読み直す形の `open` や `openPlan`・`freshPlan` などは自前の待ちを持つ）
- `clickMenu(page, 行き先, scope)`：左のメニューの項目を名前で押す（畳んだ親の中なら開いてから。名前は 予定・利用者さん・スタッフ・設定・基本情報・組む・担当を組む・組み方の標準）。メニューを押して移ることそのものを確かめるときだけ使い、ただ移りたいなら `goTo`
- `pressTool(page, 操作, { where })`：操作の行のボタンを名前で押す。既定は行にあっても「その他 ▾」の中でも押せる。`where: 'row'`・`where: 'more'` は位置そのものを確かめる所に付ける（`元に戻す`・`欠勤`（入は `where: 'more'`）・`勤務の見込み`・`印刷`・`担当なしを組む`・`予定を入れる`・`担当を組む`・`確定`・`使い方`・`メールで送る` ほか。表は `TOOLS`。表に無い名前は testid として行→「その他 ▾」の順に探す）。`openMore`・`closeMore` は「その他 ▾」の開け閉め
- `undoState(page)`・`toolCount(page, testId)`：「元に戻す」の状態（押せるか・手の名前）を「その他 ▾」を開いて読む／行と「その他 ▾」の中を合わせた testid の数
- `openScreenDetails(page)`：画面の「詳しく ▾」（月・週・日）を開く（開け閉めは覚えるので、以後その画面は開いて始まる）
- `openDetails(page, testId)`・`reveal(page, testId)`：「詳しく ▾」を開く／その要素を含む畳んだ「詳しく ▾」だけ開いて見えるまで待つ。畳んだ中の点数・移動・凡例を読む前に `reveal`。管理者設定のひな形の「適用」は `scripts/lib/features.cjs` の `applyTemplate` が `openDetails(page, 'feature-templates-fold')` で開いてから押す
- 使い分け：画面そのものの作り（メニューの並び・操作の行の中身・「詳しく ▾」の開け閉め）を確かめる e2e は位置を直に見てよい。ほかの確かめのために「移る・押す・開く」だけの所は共通の手を使う

## 環境変数

どのスクリプトも同じ（読むのは `scripts/lib/env.cjs`）。

| 名前 | 意味 |
|---|---|
| `BASE` | 開くサイト（既定 `http://localhost:4183/`） |
| `OUT_DIR` | スクリーンショットの置き場所（既定は OS の一時フォルダの `e2e-<名前>`。止まったときは `<名前>-fail-<段階>.png`） |
| `FAKE_NOW` | ページの時計を止める時刻（ISO 8601。既定は次の水曜の日本時間 12:00。テストの「今日」も日本時間。`npm run e2e` では設定ファイルが1回だけ決めて全部の worker にそろえる） |
| `CHROMIUM` | Chromium の実行ファイル |
| `PLAYWRIGHT` | Playwright のモジュールの場所（単独で走らせるとき。既定は `require('playwright')`、無ければ `/opt/node22/lib/node_modules/playwright`） |
| `PERF_MS_COMPAT`・`PERF_MS_NAV`・`PERF_MS_NAV_CARE`・`PERF_MS_PROGRESS`・`PERF_MS_VACANCY`・`PERF_MS_DETAILS` | 速さの上限（ミリ秒。無ければ `PERF_MS`。既定は下の表） |

## 各スクリプトで確かめること

画面の仕様の正は `docs/design/pages-*.md`。確かめる項目の細かい一覧は各スクリプトの先頭のコメントが正（ここは索引）。

| スクリプト | 確かめる画面・こと | 備考 |
|---|---|---|
| `e2e-absence.cjs` | 欠勤・当日キャンセルの欄（入口・段階・振り直し 案A／案B・差の欄・連絡の一覧） | |
| `e2e-address.cjs` | 住所の入力（〈利用者さん〉・空き状況の場所・〈スタッフ〉の自宅。郵便番号・候補・失敗と時間切れ・名簿のあとの「位置の無い N人を地図に置く」） | 時間切れを待つので1分ほど |
| `e2e-arrange.cjs` | 担当を組む（予定を組むの段・範囲・提案の帯・反映・組み直しの知らせ・基本情報の表） | |
| `e2e-basic-auto.cjs` | 「基本」で予定が自動で決まる（訪問・繰り返しを足すと担当が付く・帯の［担当なしを組む］・確定の段階なし・自動の伝えた記録・「変更あり」と連絡の一覧） | |
| `e2e-chip-containers.cjs` | 札の3段と入れ物（週の表の札と「+N」・選ぶ・キー・ドラッグ・月のマス・`data-marks` が3段で同じ） | 1400px・390px |
| `e2e-compat.cjs` | 相性の画面（吹き出し・絞り込みと URL・300人×60人の速さ） | `PERF_MS_COMPAT`（セルを押して描き終わるまで。既定 100ms） |
| `e2e-day-ops.cjs` | 日の予定の操作（スマホの日ごとのリスト・下から出る欄・複数選択／広い画面の帯のキー・範囲の小さな帯・パレットの訪問） | 390px・1400px |
| `e2e-details.cjs` | 予定（月・週・日）の名前から開く詳細 | `PERF_MS_DETAILS`（吹き出しが出るまで。既定 100ms） |
| `e2e-details2.cjs` | 名前から詳細を開く場所（日の予定の入らなかった訪問・受けられる人・帯）・顧客台帳の形の名簿の読み込み・最終勤務日の知らせ | |
| `e2e-dialog.cjs` | 独自の確認ダイアログ（ネイティブのダイアログが出たら失敗・ARIA・フォーカス・Esc・背景・390px・印刷） | |
| `e2e-drag.cjs` | 本物のマウスでのドラッグ5種類（表・月の一覧の行は e2e-chip-containers・e2e-shared-parts）・週の〈利用者さん〉で見るの初期値（先頭8人） | |
| `e2e-features.cjs`・`e2e-features2.cjs` | 機能の入り切り（ひな形ごとのメニュー・下のタブ・パレット・起動の画面・切った URL／画面の中の入口・相性を切る・切ったまま保存）・管理者設定の見せ方 | 共通の部品は `scripts/lib/features.cjs` |
| `e2e-home.cjs` | ホームは無い・要対応の帯（入）・`?do=`・まとめて確定・次の確定していない日へ | |
| `e2e-links.cjs` | 行き止まりから次の画面へ移る道（月の要対応の行き先・勤務の見込み・勤務時間（シフト）・空き状況） | 別のタブでデータを書き換えて作る |
| `e2e-mail.cjs` | 日・週の予定のメール（全員分の「メールを作る」で確定）・予約送信（つなぐ・接続を試す・予約して確定・取り消す・設定の手順の畳み） | GAS は偽の応答 |
| `e2e-mobile.cjs` | スマホ（390×844）のメニュー・引き出し・下のタブ・浮いている部品・狭い画面の表（カード・端の印）・1400px | |
| `e2e-nav.cjs` | メニューの並び・コマンドパレット・390px | `PERF_MS_NAV`（1文字。既定 100ms）・`PERF_MS_NAV_CARE`（「要対応」を打ったときの1回の止まり。既定 300ms） |
| `e2e-panel-foot.cjs` | 右の欄の確定のボタンの帯（短い欄・長い欄・Tab・390px・キーボード・印刷） | 1400px・390px |
| `e2e-person-page.cjs` | 〈利用者さん〉・〈スタッフ〉の画面の予定（カレンダー・空き枠のドラッグ・繰り返し・休み・390px・印刷） | |
| `e2e-plan-menu.cjs` | 日の予定の手で直す操作と比較の画面 | |
| `e2e-progress.cjs` | 月の進み具合の帯（数・行き先・担当を AI で組むが画面を移っても続く・390px・印刷） | `PERF_MS_PROGRESS`（既定 3000ms）。月末（`FAKE_NOW=2026-10-28`・`2026-10-31`）でも通る |
| `e2e-schedule-tools.cjs` | 予定の日・週・月の共通の部品（操作の行・範囲の提案（画面を移っても残る）・複数選択・元に戻す）・パレットに案を比べるが出ない | |
| `e2e-shared-parts.cjs` | 訪問の札の共通の部品（週の〈利用者さん〉の表・月のマスと一覧・人の予定表で複数選択・キー・`data-marks`・落とし先の判定。週の〈スタッフ〉の表のキーと長押しは e2e-chip-containers） | 1400px・390px |
| `e2e-simple-menu.cjs` | 「基本」のメニュー5つ・要対応の帯・来月の確認（段の中でページの時計を今月の19日・25日に止め直す）・「予定を入れる」・人のタブ・人の画面の畳み・地図はボタン／入の人の一覧の「くわしい列」 | 1366px・390px |
| `e2e-standard.cjs` | 組み方の標準（段・案をくらべる・表で直す・標準にする・条件の重みの寄り道） | |
| `e2e-tour.cjs` | 最初の2問（デモは作った直後に1回組む・自分のデータと印「all」は組まない）・登録の案内・案内ツアー・ファイル選択・月の日ごとの一覧・データを守る（控え・書き出した日・片づけ・壊れたデータ） | |
| `e2e-vacancy-steps.cjs` | 空き状況の段階（いつ・何を → 場所 → 受けられる曜日・時間帯 → 次の一手）・チップとくわしい条件・答えのカードの［要約をコピー］・表の「詳しく ▾」 | `PERF_MS_VACANCY`（結果が出るまで。既定 5000ms）。住所の検索は偽の応答 |
| `e2e-view.cjs` | 人の画面の節（読むだけ・「直す → 保存」・捨てる確認・〈スタッフ〉のアイコン） | |
| `e2e-visit-panel.cjs` | 訪問の詳細の欄（開く所・日時と担当の保存・範囲・取り消し・新規・390px・印刷） | |
| `e2e-week.cjs` | 週の予定（表示の切り替え・時間軸の〈利用者さん〉・月をまたぐ週の準備と確定） | |
| `e2e-words.cjs` | 言葉と案内（点数の理由・用語の説明・言い換え・空の画面・凡例・390px・印刷） | |
