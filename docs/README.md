# docs の索引

知りたいことに当たるファイル・節だけを読む。

- どの文書も今の仕様だけを書く。経緯は git、判断の理由は ADR
- 食い違ったら：契約は `src/contracts/`、要件は `prd.md`（＋ `prd/`）、設計は `design.md`（＋ `design/`）が正

## 目的別

| 知りたいこと | 読むファイル |
|---|---|
| 作業のルール・コマンド・ディレクトリ構成 | [../AGENTS.md](../AGENTS.md) |
| 何を作るか・やらないこと・D番号の要件 | [prd.md](prd.md) §3 の索引 → テーマ別の `prd/*.md` を1つ |
| 全体図・コンポーネントの責務・データの持ち主 | [design.md](design.md) §3・§4 |
| 型・データの版・エラー・費用（契約） | [design.md](design.md) §5 → [design/contracts.md](design/contracts.md)。正は `src/contracts/` |
| 画面の仕様（ルート・部品・文言・data-testid） | [design/pages.md](design/pages.md) → 画面別の `design/pages-*.md` |
| なぜその案にしたか | [adr/](adr/)（下の一覧） |
| まだ決まっていないこと | [design.md](design.md) §8・[prd.md](prd.md) §8 |
| e2e の走らせ方・書き方 | [e2e.md](e2e.md) |

## 画面別の設計（design/）

| ファイル | 中身 |
|---|---|
| [pages.md](design/pages.md) | 共通事項・ルート一覧・確認ダイアログ・機能の入り切り |
| [pages-nav.md](design/pages-nav.md) | メニュー・下のタブ・引き出し・要対応の帯・設定のタブ・Ctrl+Z・パレット |
| [pages-common.md](design/pages-common.md) | 右の欄・予定の共通の部品・訪問の札・訪問の詳細の欄・名前の吹き出し・用語・ツアー・メール・道順 |
| [pages-bars.md](design/pages-bars.md) | 3段の時間帯のバー |
| [pages-progress.md](design/pages-progress.md) | 月の進み具合の帯・日の状態の共通フック |
| [pages-plan.md](design/pages-plan.md) | 日の予定 |
| [pages-plan-absence.md](design/pages-plan-absence.md) | 欠勤・キャンセル・振り直し・連絡の一覧 |
| [pages-month.md](design/pages-month.md) | 月の予定・まとめて確定・希望休・印刷 |
| [pages-week.md](design/pages-week.md) | 週の予定 |
| [pages-vacancy.md](design/pages-vacancy.md) | 空き状況・問い合わせの試算・案内文 |
| [pages-basics.md](design/pages-basics.md) | 基本情報の予定と相性の表 |
| [pages-clients.md](design/pages-clients.md) | 〈利用者さん〉・〈スタッフ〉の一覧と画面・住所・名簿・絞り込み |
| [pages-compat.md](design/pages-compat.md) | 相性の表 |
| [pages-staff.md](design/pages-staff.md) | 〈スタッフ〉・勤務時間・勤務の見込み |
| [pages-rules.md](design/pages-rules.md) | 条件の重み・プリセット・訪問の種類・項目・案の比較 |
| [pages-arrange.md](design/pages-arrange.md) | 担当を組む・組み直しの知らせ |
| [pages-standard.md](design/pages-standard.md) | 組み方の標準 |
| [pages-data.md](design/pages-data.md) | データ（控え・Excel・初期化・片づけ）・管理者設定 |
| [mail-schedule.md](design/mail-schedule.md) | メールの予約送信（GAS との契約） |
| [contracts.md](design/contracts.md) | 契約の詳細（データの形・条件・振り直し・繰り返し・Excel など） |

## ADR 一覧

| 番号 | 決めたこと |
|---|---|
| [0001](adr/0001-browser-only-github-pages.md) | ブラウザ完結の静的サイト |
| [0002](adr/0002-flexible-matching-rules.md) | 項目＋条件の型＋重み0〜5＋必須 |
| [0003](adr/0003-js-annealing-solver.md) | Web Worker 上の焼きなまし |
| [0004](adr/0004-ai-plan-as-base-with-pins.md) | AI の提案を土台に手直し・ピン |
| [0005](adr/0005-compare-ai-runs-by-parameters.md) | 条件を変えた AI の提案どうしで比べる |
| [0006](adr/0006-excel-template-import-export.md) | Excel の書き出し・読み込み |
| [0007](adr/0007-score-out-of-100.md) | 点数を100点満点に |
| [0008](adr/0008-editable-presets-auto-runs.md) | プリセットを編集できるデータに |
| [0009](adr/0009-merge-schedule-and-plan.md) | 日の予定を1画面に |
| [0010](adr/0010-score-ruler-fixed.md) | 点数の物差しを基準のプリセットで固定 |
| [0011](adr/0011-same-day-absence-reassign.md) | 当日の欠勤の振り直し（案A・案B） |
| [0012](adr/0012-monthly-plan-patterns-visit-types.md) | 訪問の種類と繰り返し |
| [0013](adr/0013-monthly-nth-weekday-client-leaves-visit-notes-vacancy-notice.md) | 第N曜日・休み・決まりごと・案内文 |
| [0014](adr/0014-allowed-staff-requested-off-month-print.md) | 担当を限る・希望休・月の印刷 |
| [0015](adr/0015-offboarding-workload-client-stage-same-day-cancel.md) | 退職の振り直し・勤務の見込み・段階・当日キャンセル |
| [0016](adr/0016-postal-code-and-address-search.md) | 郵便番号・住所の検索（押したときだけ） |
| [0017](adr/0017-mail-via-mailto.md) | メールは mailto: |
| [0018](adr/0018-google-maps-route-links.md) | 道順は Google マップのリンク |
| [0019](adr/0019-nav-grouped-by-person.md) | 人ごとにまとめる（廃止） |
| [0020](adr/0020-roster-excel-import-export.md) | 名簿で予定を消さずに人を足す・直す |
| [0021](adr/0021-client-filter-area.md) | 〈利用者さん〉の絞り込み・地区 |
| [0022](adr/0022-compat-page-details-and-filters.md) | 詳細の吹き出しと相性の絞り込み |
| [0024](adr/0024-mobile-nav-and-week-client-default.md) | スマホのメニュー・週の初期値 |
| [0025](adr/0025-task-first-navigation-home.md) | やりたいことから入る導線 |
| [0026](adr/0026-custom-confirm-dialog.md) | 独自の確認ダイアログ |
| [0027](adr/0027-task-ordered-menu-command-palette.md) | 用途順のメニュー・コマンドパレット |
| [0028](adr/0028-feature-toggles-by-admin.md) | 機能の入り切り |
| [0029](adr/0029-e2e-playwright-test-runner-ci.md) | e2e を @playwright/test と CI で |
| [0030](adr/0030-reassign-and-undo-without-drag.md) | ドラッグ以外の担当替え |
| [0031](adr/0031-month-bulk-confirm-and-seed-plans.md) | 問題の無い日をまとめて確定 |
| [0032](adr/0032-protect-data.md) | データを守る（控え・片づけ・知らせ） |
| [0033](adr/0033-narrow-tables-as-cards.md) | 狭い画面の表をカードに |
| [0034](adr/0034-screen-names-and-five-menu-groups.md) | 画面名・欠勤の入口の呼び名 |
| [0035](adr/0035-rules-page-edits-score-basis.md) | 条件の重み＝点数の基準を直す |
| [0036](adr/0036-page-header-and-button-tiers.md) | 見出しの型・ボタンの3段 |
| [0037](adr/0037-term-hint-info-icon.md) | 用語の説明は ⓘ |
| [0038](adr/0038-sudden-contact-step.md) | 欠勤の欄の連絡の段（段の数は 0082） |
| [0039](adr/0039-split-heavy-pages-and-map.md) | 重い画面と地図のチャンク分け |
| [0041](adr/0041-e2e-steps-soft-checks-web-first-waits.md) | e2e の段・やわらかい確かめ・待ち |
| [0042](adr/0042-month-batch-outside-page.md) | 範囲の計算を画面の外で |
| [0044](adr/0044-next-step-first-and-show-result.md) | 次の一手を1つ・確定の前に結果 |
| [0045](adr/0045-show-less-menu-settings-tour.md) | 設定のタブ・「その他 ▾」 |
| [0046](adr/0046-week-make-confirm-attention-unmade.md) | 週の予定で確定 |
| [0047](adr/0047-compat-to-people-settings-order.md) | 相性を人の側へ・設定の先頭 |
| [0048](adr/0048-rules-weight-draft-and-confirm.md) | 条件の重みを下書きと確定に |
| [0050](adr/0050-staff-mark-and-icon.md) | 〈スタッフ〉の印とアイコン |
| [0051](adr/0051-visit-panel-and-ux-stages.md) | 訪問の詳細の欄を1つに |
| [0052](adr/0052-person-page-schedule-and-sections.md) | 人の画面を全画面・節ごとの保存に |
| [0053](adr/0053-visit-owns-staff-proposals-and-told.md) | 担当は訪問に・AI は提案・確定は伝えた内容 |
| [0054](adr/0054-schedule-shared-parts-menu-six-global-undo.md) | 予定の共通の部品・全体の元に戻す |
| [0055](adr/0055-mobile-day-list-keyboard-search-five-stages-done.md) | スマホの日ごとのリスト・キー・パレット |
| [0056](adr/0056-shared-visit-parts-select-keys-drop.md) | 印・選ぶ・キー・落とし先の共通の部品 |
| [0057](adr/0057-visit-chip-sizes-and-containers.md) | 札の3段と入れ物 |
| [0058](adr/0058-schedule-toolbar-same-place-more-month-only.md) | 操作の行の位置をそろえる |
| [0059](adr/0059-mail-confirms-day-keep-leg-routes.md) | 日のメールで確定 |
| [0060](adr/0060-schedule-nav-row-same-for-month-week-day.md) | 予定のナビの行 |
| [0062](adr/0062-standard-week-and-two-modes.md) | 組み方の標準 |
| [0063](adr/0063-ai-only-in-standard-manual-schedule.md) | AI は「予定を組む」に、予定は手で |
| [0064](adr/0064-day-three-choices-until-standard.md) | 日の考え方ごとの案（廃止） |
| [0065](adr/0065-standard-flow-one-path-rules-under-arrange.md) | 標準を決める道を1本に |
| [0066](adr/0066-arrange-steps-one-at-a-time-rules-behind-standard.md) | 予定を組むを1段ずつ |
| [0067](adr/0067-arrange-basics-first-people-under-arrange.md) | 基本情報の段・組み直しの知らせ |
| [0068](adr/0068-roster-io-on-lists-with-csv.md) | 名簿の入出力を一覧へ・CSV |
| [0069](adr/0069-scheduled-mail-via-org-gas.md) | メールの予約送信（事業所の GAS） |
| [0070](adr/0070-trait-columns-per-option-and-start-year.md) | 特性を選択肢ごとの列に・開始年 |
| [0071](adr/0071-cloudflare-workers-hosting.md) | 公開先を Cloudflare Workers に |
| [0072](adr/0072-auto-arrange-on-input-expert-features.md) | 入れた分だけ自動で組む・エキスパート機能 |
| [0073](adr/0073-first-run-two-questions-auto-settle-less-on-screen.md) | 最初の2問・決まった予定・例外だけ見せる |
| [0074](adr/0074-expert-on-screens-built-on-expert-off.md) | エキスパート機能が入の画面も切の作りに |
| [0075](adr/0075-other-software-csv-forms.md) | ほかのソフトの CSV を形の一覧で |
| [0076](adr/0076-roster-import-then-place-all.md) | 名簿の読み込み後にまとめて地図に置く |
| [0077](adr/0077-attention-band-arrange-and-go.md) | 要対応の帯から担当なしを組む |
| [0078](adr/0078-vacancy-in-menu.md) | 空き状況をメニューに（下のタブは 0080） |
| [0079](adr/0079-demo-starts-arranged-month-exceptions-only.md) | デモは組み終えて始め、月のマスは例外だけ |
| [0080](adr/0080-vacancy-one-question-mobile-tab.md) | 空き状況はチップで聞き答えを先頭に・スマホの下のタブ |
| [0081](adr/0081-next-month-check.md) | 月の終わりに来月の確認を1行で |
| [0082](adr/0082-absence-two-steps-first-visit-notes.md) | 欠勤・キャンセルを2段・初めての訪問先に決まりごと |

## 文書の保ち方

`.claude/skills/solo-architecture-design/` の「設計書を育てる」に従う。追記を重ねず該当の節を書き直す。
検査：`python3 .claude/skills/solo-architecture-design/scripts/check_design.py docs/design.md`
